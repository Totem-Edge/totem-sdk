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
// Shared handler types
// ---------------------------------------------------------------------------

type DataHandler = (chunk: Uint8Array) => void;
type CloseHandler = () => void;
type ErrorHandler = (err: Error) => void;

type HandlerMap = {
  data: DataHandler[];
  close: CloseHandler[];
  error: ErrorHandler[];
};

// ---------------------------------------------------------------------------
// In-memory transport (for testing)
// ---------------------------------------------------------------------------

/**
 * In-memory transport. Create two linked instances with createInMemoryPair().
 * Data sent from one side arrives at the other asynchronously (setImmediate).
 */
export class InMemoryTransport implements ITransport {
  private _handlers: HandlerMap = { data: [], close: [], error: [] };
  private _peer: InMemoryTransport | null = null;
  private _closed = false;

  /** @internal — link two transports as a pair. */
  _linkPeer(peer: InMemoryTransport): void {
    this._peer = peer;
  }

  send(data: Uint8Array): void {
    if (this._closed) throw new Error('InMemoryTransport is closed');
    const copy = new Uint8Array(data);
    setImmediate(() => this._peer?._deliver('data', copy));
  }

  on(event: 'data', handler: DataHandler): void;
  on(event: 'close', handler: CloseHandler): void;
  on(event: 'error', handler: ErrorHandler): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: keyof HandlerMap, handler: any): void {
    (this._handlers[event] as unknown[]).push(handler);
  }

  close(): void {
    if (this._closed) return;
    this._closed = true;
    setImmediate(() => {
      this._deliver('close');
      this._peer?._deliver('close');
    });
  }

  /**
   * Simulate the remote peer (server) dropping the connection.
   * Fires 'close' on BOTH sides — matching real TCP behaviour where both
   * the server and client streams close when the connection is torn down.
   */
  _simulateServerClose(): void {
    setImmediate(() => {
      this._deliver('close');           // server transport closes
      this._peer?._deliver('close');    // client transport sees it too
    });
  }

  /** @internal */
  _deliver(event: 'data', chunk: Uint8Array): void;
  _deliver(event: 'close'): void;
  _deliver(event: 'error', err: Error): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _deliver(event: keyof HandlerMap, ...args: any[]): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this._handlers[event] as ((...a: any[]) => void)[]).forEach(h => h(...args));
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

/**
 * Wraps a Node.js duplex stream as ITransport.
 * Used for real Hyperswarm connections.
 */
export class NodeStreamTransport implements ITransport {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly _stream: any) {}

  send(data: Uint8Array): void {
    this._stream.write(Buffer.from(data));
  }

  on(event: 'data', handler: DataHandler): void;
  on(event: 'close', handler: CloseHandler): void;
  on(event: 'error', handler: ErrorHandler): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, handler: any): void {
    if (event === 'data') {
      this._stream.on('data', (chunk: Buffer | Uint8Array) => {
        (handler as DataHandler)(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
      });
    } else {
      this._stream.on(event, handler);
    }
  }

  close(): void {
    this._stream.destroy?.();
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly _ws: any) {
    this._ws.binaryType = 'arraybuffer';
  }

  send(data: Uint8Array): void {
    this._ws.send(data.buffer.byteLength === data.length ? data.buffer : data.slice().buffer);
  }

  on(event: 'data', handler: DataHandler): void;
  on(event: 'close', handler: CloseHandler): void;
  on(event: 'error', handler: ErrorHandler): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, handler: any): void {
    if (event === 'data') {
      this._ws.addEventListener('message', (ev: MessageEvent) => {
        const raw = ev.data;
        const bytes =
          raw instanceof ArrayBuffer
            ? new Uint8Array(raw)
            : raw instanceof Uint8Array
              ? raw
              : new Uint8Array(Buffer.from(raw as string, 'binary'));
        (handler as DataHandler)(bytes);
      });
    } else if (event === 'close') {
      this._ws.addEventListener('close', handler);
    } else if (event === 'error') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this._ws.addEventListener('error', (ev: any) => {
        (handler as ErrorHandler)(
          new Error((ev as { message?: string }).message ?? 'WebSocket error'),
        );
      });
    }
  }

  close(): void {
    this._ws.close();
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
