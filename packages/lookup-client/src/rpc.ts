/**
 * Request/response correlation layer for @totemsdk/lookup-client.
 *
 * - sendRequest(msg, timeoutMs): adds a unique `id`, sends, and waits for a
 *   response message with the same `id`. Rejects on ERROR or timeout.
 * - sendRaw(msg): fire-and-forget — no correlation, no waiting.
 * - onPush(type, handler): register a handler for server-push messages
 *   (e.g. COIN_UPDATE) that arrive without a matching request id.
 */

import { encodeMessage, PROTOCOL_VERSION } from '@totemsdk/lookup-protocol';
import type { LookupMessage, MessageType } from '@totemsdk/lookup-protocol';
import { FrameParser } from './transport.js';
import type { ITransport } from './types.js';
import type { Authenticator } from './auth.js';

export class LookupClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'LookupClientError';
  }
}

type MessageHandler = (msg: LookupMessage) => void;

interface PendingRequest {
  resolve: (msg: LookupMessage) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

let _idCounter = 0;
function nextId(): string {
  return `req-${++_idCounter}`;
}

export class RpcLayer {
  private _pending = new Map<string, PendingRequest>();
  private _pushHandlers = new Map<MessageType, MessageHandler[]>();
  private _transport: ITransport | null = null;
  private _parser = new FrameParser();
  /** RFC-032: stamps a WOTS auth envelope on every outgoing message. */
  private _authenticator: Authenticator | null = null;
  /** RFC-032-A: invoked once when the node reports an expired/rejected ticket. */
  private _onSessionExpired: (() => void) | null = null;

  constructor(private readonly _defaultTimeoutMs = 10_000) {}

  /** Set the post-quantum authenticator used to stamp outgoing messages. */
  setAuthenticator(auth: Authenticator): void {
    this._authenticator = auth;
  }

  /** RFC-032-A: register a callback fired when a ticket is rejected as expired. */
  setOnSessionExpired(cb: () => void): void {
    this._onSessionExpired = cb;
  }

  /** Stamp `auth` onto a message when an authenticator is configured. */
  private _stamp(msg: LookupMessage): LookupMessage {
    if (!this._authenticator) return msg;
    // HELLO / PING are unauthenticated pre-handshake liveness messages.
    if (msg.type === 'HELLO' || msg.type === 'PING') return msg;
    return this._authenticator.stamp(msg);
  }

  // ---------------------------------------------------------------------------
  // Transport attachment
  // ---------------------------------------------------------------------------

  attach(transport: ITransport): void {
    this._transport = transport;
    this._parser.reset();
    transport.onData((chunk) => {
      const messages = this._parser.push(chunk);
      for (const msg of messages) {
        this._route(msg);
      }
    });
  }

  /** Detach transport and reject all in-flight requests. */
  detach(): void {
    this._transport = null;
    for (const [, pending] of this._pending) {
      clearTimeout(pending.timer);
      pending.reject(new LookupClientError('CONNECTION_LOST', 'Connection lost'));
    }
    this._pending.clear();
  }

  // ---------------------------------------------------------------------------
  // Message routing
  // ---------------------------------------------------------------------------

  private _route(msg: LookupMessage): void {
    // 1. Match ERROR by requestId in payload
    if (msg.type === 'ERROR') {
      const { code, message, requestId } = msg.payload as {
        code: string;
        message: string;
        requestId?: string;
      };
      if (requestId) {
        const pending = this._pending.get(requestId);
        if (pending) {
          clearTimeout(pending.timer);
          this._pending.delete(requestId);
          pending.reject(new LookupClientError(code, message));
          return;
        }
      }
      // RFC-032-A: a rejected/expired ticket invalidates the session; drop it and
      // let the client re-open. (In-flight callers see SESSION_EXPIRED and may retry.)
      if (code === 'SESSION_EXPIRED' || code === 'AUTH_REPLAY') {
        this._authenticator?.clearTicket();
        this._onSessionExpired?.();
      }
    }

    // 2. Match any message by `id` → resolve pending request
    if (msg.id) {
      const pending = this._pending.get(msg.id);
      if (pending) {
        clearTimeout(pending.timer);
        this._pending.delete(msg.id);
        pending.resolve(msg);
        return;
      }
    }

    // 3. Auto-respond to PING
    if (msg.type === 'PING') {
      const { ts } = msg.payload as { ts: number };
      try {
        this.sendRaw({ type: 'PONG', version: PROTOCOL_VERSION, payload: { ts: Date.now(), echo: ts } });
      } catch {
        // Not connected — ignore
      }
      return;
    }

    // 4. Route to push handlers (COIN_UPDATE, VERSION_MISMATCH, etc.)
    const handlers = this._pushHandlers.get(msg.type);
    if (handlers) handlers.forEach(h => h(msg));
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Send a request and wait for a correlated response.
   * Assigns a unique `id` unless one is already set.
   */
  sendRequest(
    msg: Omit<LookupMessage, 'id'> & { id?: string },
    timeoutMs?: number,
  ): Promise<LookupMessage> {
    timeoutMs = timeoutMs ?? this._defaultTimeoutMs;
    const id = (msg as { id?: string }).id ?? nextId();
    const fullMsg = { ...msg, id } as LookupMessage;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(id);
        reject(new LookupClientError('TIMEOUT', `Request ${id} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this._pending.set(id, { resolve, reject, timer });
      this.sendRaw(fullMsg);
    });
  }

  /** Send a message without expecting a response (stamped with WOTS auth). */
  sendRaw(msg: LookupMessage): void {
    if (!this._transport) throw new LookupClientError('NOT_CONNECTED', 'Not connected to lookup node');
    this._transport.send(encodeMessage(this._stamp(msg)));
  }

  /**
   * Register a handler for server-pushed messages of `type`.
   * Returns an unsubscribe function.
   */
  onPush(type: MessageType, handler: MessageHandler): () => void {
    if (!this._pushHandlers.has(type)) this._pushHandlers.set(type, []);
    this._pushHandlers.get(type)!.push(handler);
    return () => {
      const arr = this._pushHandlers.get(type) ?? [];
      this._pushHandlers.set(type, arr.filter(h => h !== handler));
    };
  }
}
