/**
 * @totemsdk/stream-transport
 *
 * Transport-layer abstractions for Totem SDK:
 *   - IStreamTransport — canonical bidirectional byte-stream interface
 *   - NodeStreamTransport — wraps Node.js Duplex/Socket streams
 *   - WebSocketTransport — browser/server WebSocket adapter
 *   - WebRTCDataChannelTransport — browser RTCDataChannel adapter
 *   - StdioStreamTransport — process stdin/stdout transport
 *   - HyperswarmStreamTransport — direct Hyperswarm connection adapter
 *   - InMemoryTransport / createInMemoryPair — in-process test helpers
 *   - createHyperswarmTransport — factory for Hyperswarm P2P connections
 *   - createWebSocketTransport — factory for WebSocket connections
 *   - channelTopic / peerTopic / broadcastTopic — 32-byte DHT topic helpers
 */

// ── Core interface ─────────────────────────────────────────────────────────────

export type DataHandler = (chunk: Uint8Array) => void;
export type CloseHandler = () => void;
export type ErrorHandler = (err: Error) => void;

/**
 * Minimal bidirectional byte-stream interface.
 *
 * send()  — write bytes to the remote peer
 * on()    — subscribe to 'data', 'close', or 'error' events
 * close() — half-close / destroy the connection
 */
export interface IStreamTransport {
  send(data: Uint8Array): void;
  on(event: 'data', handler: DataHandler): void;
  on(event: 'close', handler: CloseHandler): void;
  on(event: 'error', handler: ErrorHandler): void;
  close(): void;
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
    destroy?(err?: Error): void;
    end?(): void;
  };

  constructor(stream: unknown) {
    this._stream = stream as NodeStreamTransport['_stream'];
  }

  send(data: Uint8Array): void {
    this._stream.write(Buffer.isBuffer(data) ? data : Buffer.from(data));
  }

  on(event: 'data', handler: DataHandler): void;
  on(event: 'close', handler: CloseHandler): void;
  on(event: 'error', handler: ErrorHandler): void;
  on(event: 'data' | 'close' | 'error', handler: DataHandler | CloseHandler | ErrorHandler): void {
    if (event === 'data') {
      this._stream.on('data', (chunk: unknown) => {
        const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk as ArrayBuffer);
        (handler as DataHandler)(bytes);
      });
    } else {
      this._stream.on(event, handler as (...args: unknown[]) => void);
    }
  }

  close(): void {
    if (typeof this._stream.destroy === 'function') {
      this._stream.destroy();
    } else if (typeof this._stream.end === 'function') {
      this._stream.end();
    }
  }
}

// ── WebSocketTransport ─────────────────────────────────────────────────────────

/**
 * Wraps a browser or Node.js WebSocket as IStreamTransport.
 * Compatible with both native browser WebSocket and the `ws` npm package.
 */
export class WebSocketTransport implements IStreamTransport {
  private readonly _ws: {
    send(data: Uint8Array | Buffer): void;
    addEventListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    on?: (event: string, handler: (...args: unknown[]) => void) => void;
    close(): void;
    readyState?: number;
  };

  constructor(ws: unknown) {
    this._ws = ws as WebSocketTransport['_ws'];
  }

  send(data: Uint8Array): void {
    this._ws.send(data);
  }

  on(event: 'data', handler: DataHandler): void;
  on(event: 'close', handler: CloseHandler): void;
  on(event: 'error', handler: ErrorHandler): void;
  on(event: 'data' | 'close' | 'error', handler: DataHandler | CloseHandler | ErrorHandler): void {
    if (typeof this._ws.on === 'function') {
      if (event === 'data') {
        this._ws.on('message', (msg: unknown) => {
          let bytes: Uint8Array;
          if (msg instanceof Uint8Array) {
            bytes = msg;
          } else if (msg instanceof ArrayBuffer) {
            bytes = new Uint8Array(msg);
          } else if (Buffer.isBuffer(msg)) {
            bytes = new Uint8Array(msg.buffer, msg.byteOffset, msg.byteLength);
          } else {
            bytes = new TextEncoder().encode(String(msg));
          }
          (handler as DataHandler)(bytes);
        });
      } else {
        this._ws.on(event === 'close' ? 'close' : 'error', handler as (...args: unknown[]) => void);
      }
    } else if (typeof this._ws.addEventListener === 'function') {
      if (event === 'data') {
        this._ws.addEventListener('message', (ev: unknown) => {
          const data = (ev as MessageEvent).data;
          let bytes: Uint8Array;
          if (data instanceof Uint8Array) {
            bytes = data;
          } else if (data instanceof ArrayBuffer) {
            bytes = new Uint8Array(data);
          } else {
            bytes = new TextEncoder().encode(String(data));
          }
          (handler as DataHandler)(bytes);
        });
      } else {
        this._ws.addEventListener(event, handler as (...args: unknown[]) => void);
      }
    }
  }

  close(): void {
    this._ws.close();
  }
}

// ── WebRTCDataChannelTransport ─────────────────────────────────────────────────

/**
 * Wraps an RTCDataChannel (browser WebRTC) as IStreamTransport.
 * Requires the RTCDataChannel to be in arraybuffer mode.
 */
export class WebRTCDataChannelTransport implements IStreamTransport {
  private readonly _ch: {
    send(data: Uint8Array): void;
    addEventListener(event: string, handler: (...args: unknown[]) => void): void;
    close(): void;
    binaryType?: string;
  };

  constructor(channel: unknown) {
    this._ch = channel as WebRTCDataChannelTransport['_ch'];
    if ('binaryType' in this._ch) {
      this._ch.binaryType = 'arraybuffer';
    }
  }

  send(data: Uint8Array): void {
    this._ch.send(data);
  }

  on(event: 'data', handler: DataHandler): void;
  on(event: 'close', handler: CloseHandler): void;
  on(event: 'error', handler: ErrorHandler): void;
  on(event: 'data' | 'close' | 'error', handler: DataHandler | CloseHandler | ErrorHandler): void {
    if (event === 'data') {
      this._ch.addEventListener('message', (ev: unknown) => {
        const data = (ev as MessageEvent).data;
        const bytes = data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : data instanceof Uint8Array
            ? data
            : new Uint8Array();
        (handler as DataHandler)(bytes);
      });
    } else {
      this._ch.addEventListener(event === 'close' ? 'close' : 'error', handler as (...args: unknown[]) => void);
    }
  }

  close(): void {
    this._ch.close();
  }
}

// ── StdioStreamTransport ───────────────────────────────────────────────────────

/**
 * Adapts process.stdin + process.stdout (or any pair of Readable+Writable)
 * as IStreamTransport. Useful for CLI tools and pipe-based IPC.
 */
export class StdioStreamTransport implements IStreamTransport {
  private readonly _input: {
    on(event: string, handler: (...args: unknown[]) => void): unknown;
  };
  private readonly _output: {
    write(chunk: Buffer | Uint8Array): boolean;
  };

  constructor(
    input: unknown = process.stdin,
    output: unknown = process.stdout,
  ) {
    this._input = input as StdioStreamTransport['_input'];
    this._output = output as StdioStreamTransport['_output'];
  }

  send(data: Uint8Array): void {
    this._output.write(Buffer.isBuffer(data) ? data : Buffer.from(data));
  }

  on(event: 'data', handler: DataHandler): void;
  on(event: 'close', handler: CloseHandler): void;
  on(event: 'error', handler: ErrorHandler): void;
  on(event: 'data' | 'close' | 'error', handler: DataHandler | CloseHandler | ErrorHandler): void {
    if (event === 'data') {
      this._input.on('data', (chunk: unknown) => {
        const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk as ArrayBuffer);
        (handler as DataHandler)(bytes);
      });
    } else {
      this._input.on(event === 'close' ? 'end' : 'error', handler as (...args: unknown[]) => void);
    }
  }

  close(): void {
    (process.stdin as unknown as { destroy(): void }).destroy?.();
  }
}

// ── HyperswarmStreamTransport ──────────────────────────────────────────────────

/**
 * Adapts a raw Hyperswarm connection (which is a Node.js Duplex stream)
 * to IStreamTransport. This is the production-path adapter used by OmniaSwarmImpl.
 *
 * Extends NodeStreamTransport with the connection's info (publicKey, topics).
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

type AnyHandler = (...args: unknown[]) => void;

/**
 * In-process bidirectional transport for use in unit tests.
 * Call createInMemoryPair() to get two linked InMemoryTransport instances.
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
  private readonly _handlers: Map<string, AnyHandler[]> = new Map();
  private _closed = false;

  _linkPeer(other: InMemoryTransport): void {
    this._peer = other;
    other._peer = this;
  }

  /** Fire event handlers on THIS side only. */
  _deliver(event: string, ...args: unknown[]): void {
    for (const h of this._handlers.get(event) ?? []) {
      h(...args);
    }
  }

  /** Fire 'close' on this side's handlers only (for reconnect testing). */
  _deliverClose(): void {
    setImmediate(() => {
      this._deliver('close');
    });
  }

  /**
   * Fire 'close' on BOTH sides asynchronously.
   * Use when simulating a remote side terminating the connection.
   */
  simulateRemoteClose(): void {
    setImmediate(() => {
      this._deliver('close');
      this._peer?._deliver('close');
    });
  }

  /** Alias for simulateRemoteClose(). */
  _simulateServerClose(): void {
    this.simulateRemoteClose();
  }

  send(data: Uint8Array): void {
    if (this._closed) return;
    const copy = new Uint8Array(data);
    setImmediate(() => {
      this._peer?._deliver('data', copy);
    });
  }

  on(event: 'data', handler: DataHandler): void;
  on(event: 'close', handler: CloseHandler): void;
  on(event: 'error', handler: ErrorHandler): void;
  on(event: 'data' | 'close' | 'error', handler: DataHandler | CloseHandler | ErrorHandler): void {
    const list = this._handlers.get(event) ?? [];
    list.push(handler as AnyHandler);
    this._handlers.set(event, list);
  }

  close(): void {
    if (this._closed) return;
    this._closed = true;
    setImmediate(() => {
      this._deliver('close');
      this._peer?._deliver('close');
    });
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
  const { WebSocket: NodeWS } = await import('ws');
  const ws = new NodeWS(url);
  return new Promise<WebSocketTransport>((resolve, reject) => {
    ws.on('open', () => resolve(new WebSocketTransport(ws)));
    ws.on('error', (e: Error) => reject(e));
  });
}

// ── Topic helpers (shared with OmniaSwarmImpl and LookupClient) ───────────────

import { sha3_256 } from '@noble/hashes/sha3';

function topicBuffer(namespace: string, key: string): Buffer {
  return Buffer.from(sha3_256(`${namespace}:${key}`));
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
