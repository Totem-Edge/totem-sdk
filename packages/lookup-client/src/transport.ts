/**
 * Transport implementations for @totemsdk/lookup-client.
 *
 * - FrameParser: accumulates stream chunks, emits complete framed messages.
 * - InMemoryTransport: in-process linked pair for testing.
 * - NodeStreamTransport: wraps a Node.js Duplex (e.g. Hyperswarm connection).
 * - WebSocketTransport: wraps a WebSocket — portable across Node 18+, browsers, Pear/Bare.
 * - createHyperswarmTransport: tries Hyperswarm (dynamic import), falls back to WebSocket.
 */

import { decodeMessage, peekFrameLength } from '@totemsdk/lookup-protocol';
import type { LookupMessage } from '@totemsdk/lookup-protocol';
import type { ITransport, LookupClientConfig } from './types.js';
import {
  ClosedTransportError,
  type DataHandler,
  type CloseHandler,
  type ErrorHandler,
  type TransportState,
} from '@totemsdk/stream-transport';

// ---------------------------------------------------------------------------
// Frame parser
// ---------------------------------------------------------------------------

/**
 * Accumulates raw incoming bytes and slices out complete length-prefixed frames.
 * Compatible with the 4-byte big-endian uint32 header from @totemsdk/lookup-protocol.
 */
export class FrameParser {
  private _buf = new Uint8Array(0);

  push(chunk: Uint8Array): LookupMessage[] {
    const combined = new Uint8Array(this._buf.length + chunk.length);
    combined.set(this._buf);
    combined.set(chunk, this._buf.length);
    this._buf = combined;

    const messages: LookupMessage[] = [];
    while (this._buf.length >= 4) {
      const bodyLen = peekFrameLength(this._buf);
      if (bodyLen === null || this._buf.length < 4 + bodyLen) break;
      messages.push(decodeMessage(this._buf.slice(0, 4 + bodyLen)));
      this._buf = this._buf.slice(4 + bodyLen);
    }
    return messages;
  }

  reset(): void {
    this._buf = new Uint8Array(0);
  }
}

// ---------------------------------------------------------------------------
// In-memory transport (for testing)
// ---------------------------------------------------------------------------

/**
 * In-memory transport. Create two linked instances with createInMemoryPair().
 * Data sent from one side arrives at the other asynchronously (setImmediate).
 */
export class InMemoryTransport implements ITransport {
  private readonly _data = new Set<DataHandler>();
  private readonly _close = new Set<CloseHandler>();
  private readonly _error = new Set<ErrorHandler>();
  private _peer: InMemoryTransport | null = null;
  private _closed = false;
  private _state: TransportState = 'open';

  get state(): TransportState {
    return this._state;
  }

  /** @internal — link two transports as a pair. */
  _linkPeer(peer: InMemoryTransport): void {
    this._peer = peer;
  }

  send(data: Uint8Array): Promise<void> {
    if (this._closed) throw new ClosedTransportError();
    const copy = new Uint8Array(data);
    setImmediate(() => this._peer?._deliverData(copy));
    return Promise.resolve();
  }

  onData(handler: DataHandler): () => void {
    this._data.add(handler);
    return () => this._data.delete(handler);
  }

  onClose(handler: CloseHandler): () => void {
    this._close.add(handler);
    return () => this._close.delete(handler);
  }

  onError(handler: ErrorHandler): () => void {
    this._error.add(handler);
    return () => this._error.delete(handler);
  }

  close(): Promise<void> {
    if (this._closed) return Promise.resolve();
    this._closed = true;
    this._state = 'closed';
    setImmediate(() => {
      this._deliverClose();
      this._peer?._deliverClose();
    });
    return Promise.resolve();
  }

  /**
   * Simulate the remote peer (server) dropping the connection.
   * Fires 'close' on BOTH sides — matching real TCP behaviour where both
   * the server and client streams close when the connection is torn down.
   */
  _simulateServerClose(): void {
    setImmediate(() => {
      this._deliverClose();           // server transport closes
      this._peer?._deliverClose();    // client transport sees it too
    });
  }

  /** @internal */
  _deliverData(chunk: Uint8Array): void {
    this._data.forEach((h) => h(chunk));
  }

  /** @internal */
  _deliverClose(): void {
    this._close.forEach((h) => h());
  }

  /** @internal */
  _deliverError(err: Error): void {
    this._error.forEach((h) => h(err));
  }
}

/**
 * Create a linked pair of in-memory transports.
 * Returns [clientSide, serverSide] — messages sent from one arrive at the other.
 */
export function createInMemoryPair(): [InMemoryTransport, InMemoryTransport] {
  const a = new InMemoryTransport();
  const b = new InMemoryTransport();
  a._linkPeer(b);
  b._linkPeer(a);
  return [a, b];
}

// ---------------------------------------------------------------------------
// Node.js stream transport (for Hyperswarm connections)
// ---------------------------------------------------------------------------

const toBytes = (chunk: Buffer | Uint8Array): Uint8Array =>
  chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);

/**
 * Wraps a Node.js duplex stream as ITransport.
 * Used for real Hyperswarm connections.
 */
export class NodeStreamTransport implements ITransport {
  private readonly _data = new Set<DataHandler>();
  private readonly _close = new Set<CloseHandler>();
  private readonly _error = new Set<ErrorHandler>();
  private _state: TransportState = 'open';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _stream: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(stream: any) {
    this._stream = stream;
    stream.on('data', (chunk: Buffer | Uint8Array) => {
      this._data.forEach((h) => h(toBytes(chunk)));
    });
    stream.on('close', () => {
      this._state = 'closed';
      this._close.forEach((h) => h());
    });
    stream.on('error', (err: Error) => {
      this._error.forEach((h) => h(err));
    });
  }

  get state(): TransportState {
    return this._state;
  }

  send(data: Uint8Array): Promise<void> {
    if (this._state === 'closed') throw new ClosedTransportError();
    this._stream.write(Buffer.from(data));
    return Promise.resolve();
  }

  onData(handler: DataHandler): () => void {
    this._data.add(handler);
    return () => this._data.delete(handler);
  }

  onClose(handler: CloseHandler): () => void {
    this._close.add(handler);
    return () => this._close.delete(handler);
  }

  onError(handler: ErrorHandler): () => void {
    this._error.add(handler);
    return () => this._error.delete(handler);
  }

  close(): Promise<void> {
    this._state = 'closed';
    this._stream.destroy?.();
    return Promise.resolve();
  }
}

// ---------------------------------------------------------------------------
// WebSocket transport (fallback for HTTP/WS URLs)
// ---------------------------------------------------------------------------

/**
 * Wraps a WebSocket as ITransport.
 * Portable: works in Node 18+, browsers, and Pear/Bare runtimes.
 * Binary messages are sent as ArrayBuffer.
 */
export class WebSocketTransport implements ITransport {
  private readonly _data = new Set<DataHandler>();
  private readonly _close = new Set<CloseHandler>();
  private readonly _error = new Set<ErrorHandler>();
  private _state: TransportState = 'open';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _ws: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(ws: any) {
    this._ws = ws;
    ws.binaryType = 'arraybuffer';
    ws.addEventListener('message', (ev: { data: unknown }) => {
      const raw = ev.data;
      const bytes =
        raw instanceof ArrayBuffer
          ? new Uint8Array(raw)
          : raw instanceof Uint8Array
            ? raw
            : new Uint8Array(Buffer.from(raw as string, 'binary'));
      this._data.forEach((h) => h(bytes));
    });
    ws.addEventListener('close', () => {
      this._state = 'closed';
      this._close.forEach((h) => h());
    });
    ws.addEventListener('error', (ev: { message?: string }) => {
      const err = new Error(ev.message ?? 'WebSocket error');
      this._error.forEach((h) => h(err));
    });
  }

  get state(): TransportState {
    return this._state;
  }

  send(data: Uint8Array): Promise<void> {
    if (this._state === 'closed') throw new ClosedTransportError();
    this._ws.send(data.buffer.byteLength === data.length ? data.buffer : data.slice().buffer);
    return Promise.resolve();
  }

  onData(handler: DataHandler): () => void {
    this._data.add(handler);
    return () => this._data.delete(handler);
  }

  onClose(handler: CloseHandler): () => void {
    this._close.add(handler);
    return () => this._close.delete(handler);
  }

  onError(handler: ErrorHandler): () => void {
    this._error.add(handler);
    return () => this._error.delete(handler);
  }

  close(): Promise<void> {
    this._state = 'closed';
    this._ws.close();
    return Promise.resolve();
  }
}

/**
 * Connect to a lookup node via WebSocket.
 * Converts http(s):// URLs to ws(s):// automatically.
 * Uses globalThis.WebSocket (available in Node 18.13+, browsers, Pear/Bare).
 */
export async function createWebSocketTransport(nodeUrl: string): Promise<ITransport> {
  const wsUrl = nodeUrl.replace(/^https?:\/\//, (m) =>
    m.startsWith('https') ? 'wss://' : 'ws://',
  );

  const WS =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).WebSocket ??
    // Node 18.x before 18.13 may not have the global — try dynamic import
    (await import('ws' as string).then((m: { default?: unknown }) => m.default).catch(() => null));

  if (!WS) {
    throw new Error(
      `WebSocket not available in this runtime. ` +
        `On Node < 18.13, install the 'ws' package as a peer dependency.`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ws = new (WS as any)(wsUrl);

  return new Promise<ITransport>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`WebSocket connection timeout: ${wsUrl}`)),
      15_000,
    );
    ws.addEventListener('open', () => {
      clearTimeout(timer);
      resolve(new WebSocketTransport(ws));
    });
    ws.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error(`WebSocket connection failed: ${wsUrl}`));
    });
  });
}

// ---------------------------------------------------------------------------
// Transport factory
// ---------------------------------------------------------------------------

/**
 * Create a transport by connecting to the lookup node.
 *
 * Priority order:
 *   1. Hyperswarm P2P (dynamic import — optional peer dep) when hyperswarmTopic is set.
 *   2. WebSocket (globalThis.WebSocket or 'ws' package) when nodeUrl is set.
 *   3. Descriptive error if neither is configured.
 */
export async function createHyperswarmTransport(
  config: LookupClientConfig,
): Promise<ITransport> {
  // ── Primary: Hyperswarm ──────────────────────────────────────────────────
  if (config.hyperswarmTopic) {
    try {
      const { default: Hyperswarm } = await (
        import('hyperswarm' as string) as Promise<{ default: new () => unknown }>
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const swarm = new (Hyperswarm as any)();
      const topicBytes = Buffer.from(config.hyperswarmTopic, 'hex');

      return await new Promise<ITransport>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('Hyperswarm connect timeout (15s)')),
          15_000,
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        swarm.on('connection', (conn: any) => {
          clearTimeout(timer);
          resolve(new NodeStreamTransport(conn));
        });
        swarm.join(topicBytes, { client: true, server: false });
        swarm.flush().catch(reject);
      });
    } catch {
      // Hyperswarm not installed or connection failed — fall through to WebSocket
      if (!config.nodeUrl) {
        throw new Error(
          `Hyperswarm transport failed and no nodeUrl fallback is configured. ` +
            `Install 'hyperswarm' as a peer dependency or provide nodeUrl in config.`,
        );
      }
    }
  }

  // ── Fallback: WebSocket ─────────────────────────────────────────────────
  if (config.nodeUrl) {
    return createWebSocketTransport(config.nodeUrl);
  }

  throw new Error(
    'No transport available. Provide hyperswarmTopic, nodeUrl, or _transport/_transportFactory in config.',
  );
}
