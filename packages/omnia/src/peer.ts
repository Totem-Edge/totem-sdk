/**
 * OmniaPeer — per-connection peer handle with reconnect and message routing.
 *
 * Uses OmniaStream for typed message I/O, then adds:
 *   - Reconnect with exponential backoff (emits onReconnecting / onReconnected)
 *   - Listener management across reconnects
 *   - Stream rebind via `rebindStream()` — called by OmniaSwarmImpl when a new inbound
 *     connection arrives from the same pubkey
 *   - Thread-safe disconnect guard
 */

import { OmniaStream } from './stream.js';
import type { IStreamTransport } from '@totemsdk/stream-transport';
import type { OmniaPeer, OmniaMessage, Unsubscribe } from './messaging-types.js';

type SimpleListener<T extends unknown[]> = (...args: T) => void;

export interface OmniaPeerOptions {
  pubkey: string;
  channelId?: string;
  maxReconnectAttempts?: number;
  reconnectBaseDelayMs?: number;
  reconnectFactory?: () => Promise<IStreamTransport>;
}

export class OmniaPeerImpl implements OmniaPeer {
  readonly pubkey: string;
  readonly channelId: string | undefined;

  private _stream: OmniaStream;
  private _messageListeners: SimpleListener<[OmniaMessage]>[] = [];
  private _reconnectingListeners: SimpleListener<[number]>[] = [];
  private _reconnectedListeners: SimpleListener<[]>[] = [];
  private _disconnected = false;
  private _streamClosed = false;
  private _reconnectAttempt = 0;
  private _streamVersion = 0;
  private _openWaiters: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];

  private readonly _maxReconnectAttempts: number;
  private readonly _reconnectBaseDelayMs: number;
  private readonly _reconnectFactory?: () => Promise<IStreamTransport>;

  constructor(stream: IStreamTransport, opts: OmniaPeerOptions) {
    this.pubkey = opts.pubkey;
    this.channelId = opts.channelId;
    this._maxReconnectAttempts = opts.maxReconnectAttempts ?? 5;
    this._reconnectBaseDelayMs = opts.reconnectBaseDelayMs ?? 500;
    this._reconnectFactory = opts.reconnectFactory;
    this._stream = this._attachStream(stream);
  }

  private _attachStream(raw: IStreamTransport): OmniaStream {
    this._streamClosed = false;
    const waiters = this._openWaiters;
    this._openWaiters = [];
    for (const waiter of waiters) waiter.resolve();
    const stream = new OmniaStream(raw);
    const attachedVersion = this._streamVersion;

    stream.onMessage((msg: OmniaMessage) => {
      const snapshot = this._messageListeners.slice();
      for (const cb of snapshot) {
        try { cb(msg); } catch { /* listener errors must not crash the peer */ }
      }
    });

    stream.onClose(() => {
      // A superseded stream closing after a rebind must not mark the peer
      // disconnected; only the current stream's close is meaningful.
      if (this._disconnected || this._streamVersion !== attachedVersion) return;
      this._streamClosed = true;
      if (process.env.OMNIA_DEBUG) console.error('[peer] stream closed', this.pubkey);
      this._scheduleReconnect();
    });

    stream.onError((err: Error) => {
      if (process.env.OMNIA_DEBUG) console.error('[peer] stream error', this.pubkey, err?.message ?? String(err));
      if (!this._disconnected && this._streamVersion === attachedVersion) {
        stream.destroy();
      }
    });

    return stream;
  }

  private _scheduleReconnect(): void {
    if (!this._reconnectFactory || this._reconnectAttempt >= this._maxReconnectAttempts) {
      return;
    }

    const attempt = ++this._reconnectAttempt;
    const capturedVersion = this._streamVersion;
    const delay = Math.min(
      this._reconnectBaseDelayMs * Math.pow(2, attempt - 1),
      30_000,
    );

    for (const cb of this._reconnectingListeners) {
      try { cb(attempt); } catch { /* noop */ }
    }

    setTimeout(async () => {
      if (this._disconnected || this._streamVersion !== capturedVersion) return;
      try {
        const newRaw = await this._reconnectFactory!();
        this._streamVersion++;
        this._stream = this._attachStream(newRaw);
        this._reconnectAttempt = 0;
        for (const cb of this._reconnectedListeners) {
          try { cb(); } catch { /* noop */ }
        }
      } catch {
        this._scheduleReconnect();
      }
    }, delay);
  }

  /** True when the peer has a live transport (not deliberately closed). */
  isConnected(): boolean {
    return !this._disconnected && !this._streamClosed;
  }

  rebindStream(raw: IStreamTransport): void {
    if (this._disconnected) return;
    this._streamVersion++;
    this._reconnectAttempt = 0;
    const previous = this._stream;
    this._stream = this._attachStream(raw);
    if (process.env.OMNIA_DEBUG) console.error('[peer] rebound', this.pubkey, 'version', this._streamVersion);
    // Detach rather than close: hyperswarm owns duplicate selection and will
    // destroy the loser. Closing here could kill the socket hyperswarm kept.
    previous.detach();
    // In-flight request/reply operations use this to resend a proposal whose
    // reply (or the proposal itself) was lost when the old stream closed.
    for (const cb of this._reconnectedListeners) {
      try { cb(); } catch { /* noop */ }
    }
  }

  async sendMessage(msg: OmniaMessage): Promise<void> {
    if (this._disconnected) {
      throw new Error('Peer is disconnected');
    }
    // A duplicate-connection swap closes the old stream before the new one is
    // rebound. Wait (bounded) for the rebind rather than failing the caller.
    if (this._streamClosed) await this._waitForStream(15_000);
    if (this._disconnected) throw new Error('Peer is disconnected');
    await this._stream.send(msg);
  }

  private _waitForStream(timeoutMs: number): Promise<void> {
    if (!this._streamClosed) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const waiter = {
        resolve: () => { clearTimeout(timer); resolve(); },
        reject: (err: Error) => { clearTimeout(timer); reject(err); },
      };
      const timer = setTimeout(() => {
        this._openWaiters = this._openWaiters.filter((w) => w !== waiter);
        reject(new Error(`Peer ${this.pubkey} stream did not reopen within ${timeoutMs}ms`));
      }, timeoutMs);
      this._openWaiters.push(waiter);
    });
  }

  onMessage(cb: (msg: OmniaMessage) => void): Unsubscribe {
    this._messageListeners.push(cb);
    return () => {
      this._messageListeners = this._messageListeners.filter(l => l !== cb);
    };
  }

  onReconnecting(cb: (attempt: number) => void): Unsubscribe {
    this._reconnectingListeners.push(cb);
    return () => {
      this._reconnectingListeners = this._reconnectingListeners.filter(l => l !== cb);
    };
  }

  onReconnected(cb: () => void): Unsubscribe {
    this._reconnectedListeners.push(cb);
    return () => {
      this._reconnectedListeners = this._reconnectedListeners.filter(l => l !== cb);
    };
  }

  disconnect(): void {
    this._disconnected = true;
    this._messageListeners = [];
    this._reconnectingListeners = [];
    this._reconnectedListeners = [];
    const waiters = this._openWaiters;
    this._openWaiters = [];
    for (const waiter of waiters) waiter.reject(new Error('Peer is disconnected'));
    this._stream.destroy();
  }
}
