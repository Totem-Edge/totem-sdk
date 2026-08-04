/**
 * @totemsdk/stream-transport
 *
 * Transport-layer abstractions for Totem SDK.
 *
 * The canonical transport contract is `IStreamTransport`:
 *
 *   - `state`              — explicit connection state
 *   - `send(data)`         — async send; resolves when the bytes are accepted by
 *                            the underlying transport or the documented backpressure
 *                            policy is applied; rejects after close or on error.
 *   - `onData`/`onClose`/`onError` — subscribe and receive an unsubscribe function.
 *   - `close()`            — async close with predictable semantics (no further
 *                            deliveries after the returned promise resolves).
 *
 * Implementations: NodeStreamTransport, WebSocketTransport,
 * WebRTCDataChannelTransport, StdioStreamTransport, HyperswarmStreamTransport,
 * and InMemoryTransport / createInMemoryPair for tests.
 *
 * Topic helpers (channelTopic / peerTopic / broadcastTopic) are Node-only
 * (they return Buffer) and are used by the Omnia swarm in Node environments.
 */

// ── Core contract ─────────────────────────────────────────────────────────────

export type TransportState = 'connecting' | 'open' | 'closing' | 'closed';

export type DataHandler = (chunk: Uint8Array) => void;
export type CloseHandler = () => void;
export type ErrorHandler = (err: Error) => void;

/**
 * Canonical bidirectional byte-stream transport contract.
 *
 * Every transport exposes the same subscription API; each `on*` method returns
 * an unsubscribe function so handlers can always be removed. There is a single
 * connection state machine and a single `send` signature. This replaces the old
 * `on(event, handler)` API which could not express unsubscription, backpressure
 * or connection state.
 */
export interface IStreamTransport {
  /** Explicit connection state. */
  readonly state: TransportState;

  /**
   * Optional async connect. Implementations that construct an already-connected
   * transport may omit it.
   */
  connect?(): Promise<void>;

  /**
   * Send bytes to the remote peer.
   *
   * - Returns a promise that resolves once the bytes are accepted by the
   *   underlying transport (or after the documented backpressure policy).
   * - Rejects with `ClosedTransportError` if the transport is closed.
   * - Rejects with the underlying error if delivery fails.
   */
  send(data: Uint8Array): Promise<void>;

  /** Subscribe to data chunks. Returns an unsubscribe function. */
  onData(handler: DataHandler): () => void;

  /** Subscribe to connection close. Returns an unsubscribe function. */
  onClose(handler: CloseHandler): () => void;

  /** Subscribe to transport errors. Returns an unsubscribe function. */
  onError(handler: ErrorHandler): () => void;

  /**
   * Close the transport. After the returned promise resolves, no further data
   * or close deliveries occur. Calling close() more than once is safe (the
   * second call resolves immediately).
   */
  close(): Promise<void>;
}

/** Thrown by send() when the transport has been closed. */
export class ClosedTransportError extends Error {
  readonly name = 'ClosedTransportError';
  constructor(message = 'transport is closed') {
    super(message);
  }
}

// ── Base helpers ──────────────────────────────────────────────────────────────

type Handler = (...args: unknown[]) => void;

/**
 * Maintains a handler list supporting subscribe/unsubscribe and removal after
 * close. Prevents unbounded handler accumulation and silent double-fires.
 */
class HandlerSet {
  private _handlers = new Set<Handler>();
  private _fired = false;

  add(handler: Handler): () => void {
    if (this._fired) return () => {};
    this._handlers.add(handler);
    return () => {
      this._handlers.delete(handler);
    };
  }

  /** Deliver to a snapshot so handlers can safely unsubscribe during delivery. */
  emit(...args: unknown[]): void {
    for (const h of [...this._handlers]) {
      h(...args);
    }
  }

  get size(): number {
    return this._handlers.size;
  }

  /** Marks the set as permanently fired; subsequent add() becomes a no-op. */
  seal(): void {
    this._fired = true;
    this._handlers.clear();
  }
}

function toBytes(chunk: unknown): Uint8Array {
  if (chunk instanceof Uint8Array) return chunk;
  if (chunk instanceof ArrayBuffer) return new Uint8Array(chunk);
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(chunk)) {
    return new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  }
  return new TextEncoder().encode(String(chunk));
}

/** True when running in a Node.js environment (Buffer exists). */
function isNode(): boolean {
  return typeof Buffer !== 'undefined';
}

// ── NodeStreamTransport ────────────────────────────────────────────────────────

/**
 * Wraps any Node.js Duplex-compatible stream (net.Socket, tls.TLSSocket,
 * Hyperswarm connection, etc.) as IStreamTransport.
 */
export class NodeStreamTransport implements IStreamTransport {
  private readonly _stream: {
    write(chunk: Buffer | Uint8Array): boolean;
    on(event: string, handler: (...args: unknown[]) => void): unknown;
    once?(event: string, handler: (...args: unknown[]) => void): unknown;
    removeListener?(event: string, handler: (...args: unknown[]) => void): unknown;
    destroy?(err?: Error): void;
    end?(): void;
  };
  private readonly _data = new HandlerSet();
  private readonly _close = new HandlerSet();
  private readonly _error = new HandlerSet();
  private _state: TransportState = 'open';
  private _closeResolve: (() => void) | null = null;
  private readonly _closePromise: Promise<void>;

  constructor(stream: unknown) {
    this._stream = stream as NodeStreamTransport['_stream'];

    this._stream.on('data', (chunk: unknown) => this._data.emit(toBytes(chunk)));

    this._stream.on('close', () => {
      if (this._state === 'closed') return;
      this._state = 'closed';
      this._data.seal();
      this._close.emit();
      this._close.seal();
      this._closeResolve?.();
    });

    this._stream.on('error', (err: unknown) => {
      this._error.emit(err instanceof Error ? err : new Error(String(err)));
    });

    this._closePromise = new Promise((resolve) => {
      this._closeResolve = resolve;
    });
  }

  get state(): TransportState {
    return this._state;
  }

  async send(data: Uint8Array): Promise<void> {
    if (this._state === 'closed' || this._state === 'closing') {
      throw new ClosedTransportError();
    }
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (!this._stream.write(buffer)) {
      // Backpressure: wait for the stream to drain before resolving.
      await new Promise<void>((resolve, reject) => {
        const onDrain = () => resolve();
        const onErr = (err: unknown) => reject(err instanceof Error ? err : new Error(String(err)));
        this._stream.once?.('drain', onDrain);
        this._stream.once?.('error', onErr);
      });
    }
  }

  onData(handler: DataHandler): () => void {
    return this._data.add(handler as Handler);
  }

  onClose(handler: CloseHandler): () => void {
    return this._close.add(handler as Handler);
  }

  onError(handler: ErrorHandler): () => void {
    return this._error.add(handler as Handler);
  }

  async close(): Promise<void> {
    if (this._state === 'closed') return;
    this._state = 'closing';
    if (typeof this._stream.destroy === 'function') {
      this._stream.destroy();
    } else if (typeof this._stream.end === 'function') {
      this._stream.end();
    }
    await this._closePromise;
  }
}

// ── WebSocketTransport ─────────────────────────────────────────────────────────

/**
 * Wraps a browser or Node.js WebSocket as IStreamTransport.
 * Compatible with both the native browser WebSocket and the `ws` npm package.
 *
 * Backpressure: `ws` exposes a send callback and `bufferedAmount`; the browser
 * WebSocket API does not. When the underlying socket is a `ws` instance, send()
 * resolves via the completion callback; for the browser API, send() resolves
 * after enqueue and backpressure is documented as not honoured (the API offers
 * no completion signal). In both cases send() rejects after close.
 */
export class WebSocketTransport implements IStreamTransport {
  private readonly _ws: {
    send(data: Uint8Array | Buffer): void;
    addEventListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    on?: (event: string, handler: (...args: unknown[]) => void) => void;
    close(): void;
    readyState?: number;
  };
  private readonly _data = new HandlerSet();
  private readonly _close = new HandlerSet();
  private readonly _error = new HandlerSet();
  private _state: TransportState = 'open';
  private _closeResolve: (() => void) | null = null;
  private readonly _closePromise: Promise<void>;

  constructor(ws: unknown) {
    this._ws = ws as WebSocketTransport['_ws'];
    if ('binaryType' in this._ws) this._ws.binaryType = 'arraybuffer';
    const register = this._ws.addEventListener ? this._ws.addEventListener.bind(this._ws) : this._ws.on?.bind(this._ws);

    register?.('message', (ev: unknown) => {
      const raw = (ev as { data?: unknown }).data ?? ev;
      this._data.emit(toBytes(raw));
    });
    register?.('close', () => {
      this._state = 'closed';
      this._data.seal();
      this._close.emit();
      this._close.seal();
      this._closeResolve?.();
    });
    register?.('error', (err: unknown) => {
      this._error.emit(err instanceof Error ? err : new Error(String(err)));
    });

    this._closePromise = new Promise((resolve) => {
      this._closeResolve = resolve;
    });
  }

  get state(): TransportState {
    return this._state;
  }

  async send(data: Uint8Array): Promise<void> {
    if (this._state === 'closed' || this._state === 'closing') {
      throw new ClosedTransportError();
    }
    await new Promise<void>((resolve, reject) => {
      try {
        if (this._ws.on) {
          // `ws` (Node) supports a completion callback; browser WebSocket does not.
          (this._ws.send as (payload: Uint8Array, callback: (err?: unknown) => void) => void)(data, (err) => {
            if (err) reject(err instanceof Error ? err : new Error(String(err)));
            else resolve();
          });
        } else {
          this._ws.send(data);
          resolve();
        }
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  onData(handler: DataHandler): () => void {
    return this._data.add(handler as Handler);
  }

  onClose(handler: CloseHandler): () => void {
    return this._close.add(handler as Handler);
  }

  onError(handler: ErrorHandler): () => void {
    return this._error.add(handler as Handler);
  }

  async close(): Promise<void> {
    if (this._state === 'closed') return;
    this._state = 'closing';
    this._ws.close();
    await this._closePromise;
  }
}

// ── WebRTCDataChannelTransport ─────────────────────────────────────────────────

/**
 * Wraps an RTCDataChannel (browser WebRTC) as IStreamTransport.
 * Requires the RTCDataChannel to be in arraybuffer mode.
 *
 * The browser RTCDataChannel API has no send-completion signal, so backpressure
 * is documented as not honoured; send() resolves after enqueue and rejects only
 * after close.
 */
export class WebRTCDataChannelTransport implements IStreamTransport {
  private readonly _ch: {
    send(data: Uint8Array): void;
    addEventListener(event: string, handler: (...args: unknown[]) => void): void;
    close(): void;
    binaryType?: string;
  };
  private readonly _data = new HandlerSet();
  private readonly _close = new HandlerSet();
  private readonly _error = new HandlerSet();
  private _state: TransportState = 'open';
  private _closeResolve: (() => void) | null = null;
  private readonly _closePromise: Promise<void>;

  constructor(channel: unknown) {
    this._ch = channel as WebRTCDataChannelTransport['_ch'];
    if ('binaryType' in this._ch) {
      this._ch.binaryType = 'arraybuffer';
    }
    this._ch.addEventListener('message', (ev: unknown) => {
      const data = (ev as { data?: unknown }).data;
      this._data.emit(toBytes(data));
    });
    this._ch.addEventListener('close', () => {
      this._state = 'closed';
      this._data.seal();
      this._close.emit();
      this._close.seal();
      this._closeResolve?.();
    });
    this._ch.addEventListener('error', (ev: unknown) => {
      this._error.emit(ev instanceof Error ? ev : new Error(String(ev)));
    });
    this._closePromise = new Promise((resolve) => {
      this._closeResolve = resolve;
    });
  }

  get state(): TransportState {
    return this._state;
  }

  async send(data: Uint8Array): Promise<void> {
    if (this._state === 'closed' || this._state === 'closing') {
      throw new ClosedTransportError();
    }
    this._ch.send(data);
  }

  onData(handler: DataHandler): () => void {
    return this._data.add(handler as Handler);
  }

  onClose(handler: CloseHandler): () => void {
    return this._close.add(handler as Handler);
  }

  onError(handler: ErrorHandler): () => void {
    return this._error.add(handler as Handler);
  }

  async close(): Promise<void> {
    if (this._state === 'closed') return;
    this._state = 'closing';
    this._ch.close();
    await this._closePromise;
  }
}

// ── StdioStreamTransport ───────────────────────────────────────────────────────

/**
 * Adapts a Node.js Readable + Writable pair (default: process.stdin/stdout)
 * as IStreamTransport. This transport is Node-only by definition.
 */
export class StdioStreamTransport implements IStreamTransport {
  private readonly _input: {
    on(event: string, handler: (...args: unknown[]) => void): unknown;
    once?(event: string, handler: (...args: unknown[]) => void): unknown;
    destroy?(): void;
  };
  private readonly _output: {
    write(chunk: Buffer | Uint8Array): boolean;
    once?(event: string, handler: (...args: unknown[]) => void): unknown;
    end?(): void;
  };
  private readonly _inputOwned: boolean;
  private readonly _outputOwned: boolean;
  private readonly _data = new HandlerSet();
  private readonly _close = new HandlerSet();
  private readonly _error = new HandlerSet();
  private _state: TransportState = 'open';
  private _closeResolve: (() => void) | null = null;
  private readonly _closePromise: Promise<void>;

  constructor(
    input: unknown = process.stdin,
    output: unknown = process.stdout,
  ) {
    this._input = input as StdioStreamTransport['_input'];
    this._output = output as StdioStreamTransport['_output'];
    this._inputOwned = input !== process.stdin;
    this._outputOwned = output !== process.stdout;

    this._input.on('data', (chunk: unknown) => this._data.emit(toBytes(chunk)));
    this._input.on('end', () => {
      if (this._state === 'closed') return;
      this._state = 'closed';
      this._data.seal();
      this._close.emit();
      this._close.seal();
      this._closeResolve?.();
    });
    this._input.on('close', () => {
      if (this._state === 'closed') return;
      this._state = 'closed';
      this._data.seal();
      this._close.emit();
      this._close.seal();
      this._closeResolve?.();
    });
    this._input.on('error', (err: unknown) => {
      this._error.emit(err instanceof Error ? err : new Error(String(err)));
    });

    this._closePromise = new Promise((resolve) => {
      this._closeResolve = resolve;
    });
  }

  get state(): TransportState {
    return this._state;
  }

  async send(data: Uint8Array): Promise<void> {
    if (this._state === 'closed' || this._state === 'closing') {
      throw new ClosedTransportError();
    }
    if (!this._output.write(Buffer.isBuffer(data) ? data : Buffer.from(data))) {
      await new Promise<void>((resolve, reject) => {
        const onDrain = () => resolve();
        const onErr = (err: unknown) => reject(err instanceof Error ? err : new Error(String(err)));
        this._output.once?.('drain', onDrain);
        this._output.once?.('error', onErr);
      });
    }
  }

  onData(handler: DataHandler): () => void {
    return this._data.add(handler as Handler);
  }

  onClose(handler: CloseHandler): () => void {
    return this._close.add(handler as Handler);
  }

  onError(handler: ErrorHandler): () => void {
    return this._error.add(handler as Handler);
  }

  async close(): Promise<void> {
    if (this._state === 'closed') return;
    this._state = 'closing';
    if (this._inputOwned) this._input.destroy?.();
    if (this._outputOwned) this._output.end?.();
    this._state = 'closed';
    this._data.seal();
    this._close.emit();
    this._close.seal();
    this._closeResolve?.();
    await this._closePromise;
  }
}

// ── HyperswarmStreamTransport ──────────────────────────────────────────────────

/**
 * Adapts a raw Hyperswarm connection (a Node.js Duplex stream) to
 * IStreamTransport, carrying the connection's info (publicKey, topics).
 */
export class HyperswarmStreamTransport extends NodeStreamTransport {
  readonly pubkey: string;
  readonly topics: Buffer[];

  constructor(conn: unknown, info: { publicKey: Buffer; topics?: Buffer[] }) {
    super(conn);
    this.pubkey = info.publicKey.toString('hex');
    this.topics = info.topics ?? [];
  }
}

// ── InMemoryTransport (test helper) ───────────────────────────────────────────

/**
 * In-process bidirectional transport for use in unit tests and the contract
 * suite. Call createInMemoryPair() to get two linked instances.
 *
 * Extra test-helper methods:
 *   _deliver(event, ...args)   — fire event handlers on this side only
 *   _deliverClose()            — fire 'close' on this side's handlers only
 *   simulateRemoteClose()      — fire 'close' on BOTH sides (asynchronous)
 *   _simulateServerClose()     — alias for simulateRemoteClose()
 *   _linkPeer(other)           — link two transports together
 */
export class InMemoryTransport implements IStreamTransport {
  private _peer: InMemoryTransport | null = null;
  private readonly _data = new HandlerSet();
  private readonly _close = new HandlerSet();
  private readonly _error = new HandlerSet();
  private _state: TransportState = 'open';

  _linkPeer(other: InMemoryTransport): void {
    this._peer = other;
    other._peer = this;
  }

  get state(): TransportState {
    return this._state;
  }

  /** Fire event handlers on THIS side only. */
  _deliver(event: string, ...args: unknown[]): void {
    if (event === 'data') this._data.emit(...args);
    else if (event === 'close') this._close.emit();
    else if (event === 'error') this._error.emit(...args);
  }

  /** Fire 'close' on this side's handlers only (for reconnect testing). */
  _deliverClose(): void {
    this._close.emit();
  }

  /**
   * Fire 'close' on BOTH sides asynchronously.
   * Use when simulating a remote side terminating the connection.
   */
  simulateRemoteClose(): void {
    this._state = 'closed';
    this._data.seal();
    this._close.emit();
    this._close.seal();
    this._peer?.simulateLocalClose();
  }

  /** Alias for simulateRemoteClose(). */
  _simulateServerClose(): void {
    this.simulateRemoteClose();
  }

  /** Internal: close this side only (used by simulateRemoteClose). */
  private simulateLocalClose(): void {
    this._state = 'closed';
    this._data.seal();
    this._close.emit();
    this._close.seal();
  }

  async send(data: Uint8Array): Promise<void> {
    if (this._state === 'closed' || this._state === 'closing') {
      throw new ClosedTransportError();
    }
    if (!this._peer) throw new ClosedTransportError('no peer linked');
    const copy = new Uint8Array(data);
    this._peer._deliver('data', copy);
  }

  onData(handler: DataHandler): () => void {
    return this._data.add(handler as Handler);
  }

  onClose(handler: CloseHandler): () => void {
    return this._close.add(handler as Handler);
  }

  onError(handler: ErrorHandler): () => void {
    return this._error.add(handler as Handler);
  }

  async close(): Promise<void> {
    if (this._state === 'closed') return;
    this._state = 'closed';
    this._data.seal();
    this._close.emit();
    this._close.seal();
    this._peer?.simulateLocalClose();
  }
}

/**
 * Create a linked pair of InMemoryTransport instances.
 * Bytes sent on [0] arrive on [1] and vice-versa.
 */
export function createInMemoryPair(): [InMemoryTransport, InMemoryTransport] {
  const a = new InMemoryTransport();
  const b = new InMemoryTransport();
  a._linkPeer(b);
  return [a, b];
}

// ── Factory: createHyperswarmTransport ────────────────────────────────────────

export interface HyperswarmTransportConfig {
  /** 32-byte topic buffer to join. */
  topic: Buffer;
  /** Optional: only accept connections matching this 32-byte pubkey. */
  targetPublicKey?: Buffer;
  /** Hyperswarm join options. Default: { server: true, client: true }. */
  joinOpts?: { server?: boolean; client?: boolean };
}

/**
 * Establishes a Hyperswarm connection and returns IStreamTransport.
 * Dynamically imports `hyperswarm` so the package remains optional at build time.
 */
export async function createHyperswarmTransport(
  config: HyperswarmTransportConfig,
): Promise<HyperswarmStreamTransport> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const HyperswarmLib = ((await (import('hyperswarm' as string))) as any).default;
  const swarm = new HyperswarmLib();

  return new Promise<HyperswarmStreamTransport>((resolve, reject) => {
    swarm.on('connection', (conn: unknown, info: { publicKey: Buffer; topics?: Buffer[] }) => {
      if (
        config.targetPublicKey &&
        !info.publicKey.equals(config.targetPublicKey)
      ) {
        return;
      }
      const transport = new HyperswarmStreamTransport(conn, info);
      resolve(transport);
    });

    const discovery = swarm.join(
      config.topic,
      config.joinOpts ?? { server: true, client: true },
    );

    discovery.flushed?.().catch(reject);
    swarm.flush().catch(reject);
  });
}

// ── Factory: createWebSocketTransport ─────────────────────────────────────────

/**
 * Creates a WebSocketTransport by connecting to the given URL.
 * Works in both browser (native WebSocket) and Node.js (ws package).
 */
export async function createWebSocketTransport(
  url: string,
): Promise<WebSocketTransport> {
  if (typeof globalThis.WebSocket !== 'undefined') {
    const ws = new globalThis.WebSocket(url);
    return new Promise<WebSocketTransport>((resolve, reject) => {
      ws.addEventListener('open', () => resolve(new WebSocketTransport(ws)));
      ws.addEventListener('error', (e: unknown) =>
        reject(new Error(`WebSocket error connecting to ${url}: ${String(e)}`)),
      );
    });
  }
  const { WebSocket: NodeWS } = await (import('ws' as string) as Promise<{
    WebSocket: new (
      url: string,
    ) => { on(event: 'open', handler: () => void): void; on(event: 'error', handler: (err: Error) => void): void };
  }>);
  const ws = new NodeWS(url);
  return new Promise<WebSocketTransport>((resolve, reject) => {
    ws.on('open', () => resolve(new WebSocketTransport(ws)));
    ws.on('error', (e: Error) => reject(e));
  });
}

// ── Topic helpers (Node-only; shared with OmniaSwarmImpl and LookupClient) ─────

import { sha3_256 } from '@totemsdk/core';

function topicBuffer(namespace: string, key: string): Buffer {
  return Buffer.from(sha3_256(new TextEncoder().encode(`${namespace}:${key}`)));
}

/**
 * 32-byte DHT topic for a specific payment channel.
 * Used by both sides to join the same swarm topic.
 */
export function channelTopic(channelId: string): Buffer {
  return topicBuffer('omnia:channel', channelId);
}

/**
 * 32-byte DHT topic for a specific peer public key.
 * Used to advertise and discover a peer's endpoint.
 */
export function peerTopic(pubkey: string): Buffer {
  return topicBuffer('omnia:peer', pubkey);
}

/**
 * 32-byte DHT topic for a broadcast namespace.
 * Used to fan-out state updates to all peers in a channel.
 */
export function broadcastTopic(namespace: string): Buffer {
  return topicBuffer('omnia:broadcast', namespace);
}

/** @internal Re-exported so consumers can assert on transport state. */
export const _isNode = isNode;
