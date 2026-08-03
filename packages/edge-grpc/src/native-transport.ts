/**
 * NativeGrpcTransport — connects to the edge-grpc Go binary over TCP.
 *
 * The Go binary listens on a local TCP socket (default 127.0.0.1:15005)
 * and accepts newline-delimited JSON requests with base64-encoded protobuf
 * payloads. This class implements GrpcTransportPort (IStreamTransport) by
 * forwarding all calls to the Go process.
 *
 * The Go binary handles real gRPC (HTTP/2, protobuf, streaming, status codes)
 * via google.golang.org/grpc. The TypeScript side only needs to pass
 * base64-encoded protobuf bytes and receive responses.
 */

import type { IStreamTransport } from '@totemsdk/stream-transport';
import type { GrpcStreamHandle } from './transport.js';

export interface NativeGrpcConfig {
  host?: string;
  port?: number;
  connectTimeoutMs?: number;
  requestTimeoutMs?: number;
}

interface Request {
  id: string;
  type: string;
  address?: string;
  path?: string;
  payload?: string;
  deadline_ms?: number;
  stream_id?: string;
}

interface Response {
  id: string;
  ok: boolean;
  data?: string;
  error?: string;
  code?: number;
  stream_id?: string;
}

interface PushMessage {
  type: string;
  stream_id: string;
  payload?: string;
  error?: string;
  code?: number;
}

type DataHandler = (chunk: Uint8Array) => void;
type CloseHandler = () => void;
type ErrorHandler = (err: Error) => void;

let requestCounter = 0;

export class NativeGrpcTransport implements IStreamTransport {
  private socket: ReturnType<typeof import('net').createConnection> | null = null;
  private buffer = '';
  private pending = new Map<string, { resolve: (resp: Response) => void; reject: (err: Error) => void }>();
  private dataHandlers = new Set<DataHandler>();
  private closeHandlers = new Set<CloseHandler>();
  private errorHandlers = new Set<ErrorHandler>();
  private readonly config: Required<NativeGrpcConfig>;
  private _state: 'connecting' | 'open' | 'closing' | 'closed' = 'connecting';
  private _closeResolve: (() => void) | null = null;
  private readonly _closePromise: Promise<void>;
  private streams = new Map<string, NativeGrpcStreamHandle>();

  constructor(config: NativeGrpcConfig = {}) {
    this.config = {
      host: config.host ?? '127.0.0.1',
      port: config.port ?? 15005,
      connectTimeoutMs: config.connectTimeoutMs ?? 5000,
      requestTimeoutMs: config.requestTimeoutMs ?? 30000,
    };
    this._closePromise = new Promise((resolve) => {
      this._closeResolve = resolve;
    });
  }

  get state(): 'connecting' | 'open' | 'closing' | 'closed' {
    return this._state;
  }

  async connect(address?: string): Promise<void> {
    const net = await import('net');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket?.destroy();
        reject(new Error(`NativeGrpcTransport: connect timeout`));
      }, this.config.connectTimeoutMs);

      this.socket = net.createConnection({ host: this.config.host, port: this.config.port }, () => {
        clearTimeout(timer);
        this._state = 'open';
        this.sendRequest('connect', { address }).then(() => resolve()).catch(reject);
      });

      this.socket.on('data', (chunk: Buffer) => {
        this.buffer += chunk.toString('utf-8');
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.type === 'stream_data' || msg.type === 'stream_end' || msg.type === 'stream_error') {
              const push = msg as PushMessage;
              const stream = this.streams.get(push.stream_id);
              if (stream) {
                stream._handlePush(push);
              }
            } else if (msg.id && this.pending.has(msg.id)) {
              const { resolve: res, reject: rej } = this.pending.get(msg.id)!;
              this.pending.delete(msg.id);
              if (msg.ok) {
                res(msg as Response);
              } else {
                const err = new Error(msg.error ?? 'unknown error');
                (err as any).code = msg.code;
                rej(err);
              }
            }
          } catch {}
        }
      });

      this.socket.on('error', (err: Error) => {
        for (const handler of [...this.errorHandlers]) {
          try { handler(err); } catch {}
        }
      });

      this.socket.on('close', () => {
        this._state = 'closed';
        for (const [, p] of this.pending) p.reject(new Error('connection closed'));
        this.pending.clear();
        for (const handler of [...this.closeHandlers]) {
          try { handler(); } catch {}
        }
        this.dataHandlers.clear();
        this.closeHandlers.clear();
        this.errorHandlers.clear();
        this._closeResolve?.();
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.socket && this._state !== 'closed') {
      try { await this.sendRequest('disconnect', {}); } catch {}
      this.socket.destroy();
      this.socket = null;
      this._state = 'closed';
      this._closeResolve?.();
    }
  }

  async send(data: Uint8Array): Promise<void> {
    // IStreamTransport.send — raw bytes. For gRPC, use unaryCall() instead.
    // This is a passthrough for the underlying transport contract.
    await this.sendRequest('send', { data: bytesToBase64(data) });
  }

  onData(handler: DataHandler): () => void {
    this.dataHandlers.add(handler);
    return () => { this.dataHandlers.delete(handler); };
  }

  onClose(handler: CloseHandler): () => void {
    this.closeHandlers.add(handler);
    return () => { this.closeHandlers.delete(handler); };
  }

  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => { this.errorHandlers.delete(handler); };
  }

  async close(): Promise<void> {
    if (this._state === 'closed') return;
    this._state = 'closing';
    await this.disconnect();
    this._state = 'closed';
    this._closeResolve?.();
  }

  // ── gRPC-specific methods ──────────────────────────────────────────────

  async unaryCall(path: string, payload: Uint8Array, deadlineMs?: number): Promise<Uint8Array> {
    const resp = await this.sendRequest('unary', {
      path,
      payload: bytesToBase64(payload),
      deadline_ms: deadlineMs ?? this.config.requestTimeoutMs,
    });
    return resp.data ? base64ToBytes(resp.data) : new Uint8Array(0);
  }

  async serverStream(path: string, payload: Uint8Array, deadlineMs?: number): Promise<GrpcStreamHandle> {
    const resp = await this.sendRequest('server_stream', {
      path,
      payload: bytesToBase64(payload),
      deadline_ms: deadlineMs ?? this.config.requestTimeoutMs,
    });
    const streamId = resp.stream_id ?? '';
    const handle = new NativeGrpcStreamHandle(streamId, this);
    this.streams.set(streamId, handle);
    return handle;
  }

  async clientStream(path: string, deadlineMs?: number): Promise<GrpcStreamHandle> {
    const resp = await this.sendRequest('client_stream', {
      path,
      deadline_ms: deadlineMs ?? this.config.requestTimeoutMs,
    });
    const streamId = resp.stream_id ?? '';
    const handle = new NativeGrpcStreamHandle(streamId, this);
    this.streams.set(streamId, handle);
    return handle;
  }

  async bidiStream(path: string, deadlineMs?: number): Promise<GrpcStreamHandle> {
    const resp = await this.sendRequest('bidi_stream', {
      path,
      deadline_ms: deadlineMs ?? this.config.requestTimeoutMs,
    });
    const streamId = resp.stream_id ?? '';
    const handle = new NativeGrpcStreamHandle(streamId, this);
    this.streams.set(streamId, handle);
    return handle;
  }

  async streamSend(streamId: string, payload: Uint8Array): Promise<void> {
    await this.sendRequest('stream_send', { stream_id: streamId, payload: bytesToBase64(payload) });
  }

  async streamClose(streamId: string): Promise<void> {
    await this.sendRequest('stream_close', { stream_id: streamId });
  }

  /** @internal */
  _removeStream(streamId: string): void {
    this.streams.delete(streamId);
  }

  private sendRequest(type: string, extra: Record<string, unknown>): Promise<Response> {
    if (!this.socket) throw new Error('NativeGrpcTransport: not connected');
    const id = `grpc-${++requestCounter}`;
    const req: Request = { id, type, ...extra } as Request;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`NativeGrpcTransport: request ${id} timed out`));
      }, this.config.requestTimeoutMs);

      this.pending.set(id, {
        resolve: (resp) => { clearTimeout(timer); resolve(resp); },
        reject: (err) => { clearTimeout(timer); reject(err); },
      });

      this.socket!.write(JSON.stringify(req) + '\n');
    });
  }
}

// ── Stream handle ────────────────────────────────────────────────────────

class NativeGrpcStreamHandle implements GrpcStreamHandle {
  private dataHandlers = new Set<(payload: Uint8Array) => void>();
  private endHandlers = new Set<() => void>();
  private errorHandlers = new Set<(err: Error) => void>();
  private _ended = false;

  constructor(
    readonly streamId: string,
    private transport: NativeGrpcTransport,
  ) {}

  async send(payload: Uint8Array): Promise<void> {
    await this.transport.streamSend(this.streamId, payload);
  }

  async close(): Promise<void> {
    await this.transport.streamClose(this.streamId);
    this._ended = true;
    this.transport._removeStream(this.streamId);
  }

  onData(handler: (payload: Uint8Array) => void): () => void {
    this.dataHandlers.add(handler);
    return () => { this.dataHandlers.delete(handler); };
  }

  onEnd(handler: () => void): () => void {
    this.endHandlers.add(handler);
    return () => { this.endHandlers.delete(handler); };
  }

  onError(handler: (err: Error) => void): () => void {
    this.errorHandlers.add(handler);
    return () => { this.errorHandlers.delete(handler); };
  }

  /** @internal */
  _handlePush(msg: PushMessage): void {
    if (msg.type === 'stream_data' && msg.payload) {
      const data = base64ToBytes(msg.payload);
      for (const h of [...this.dataHandlers]) {
        try { h(data); } catch {}
      }
    } else if (msg.type === 'stream_end') {
      this._ended = true;
      for (const h of [...this.endHandlers]) {
        try { h(); } catch {}
      }
      this.transport._removeStream(this.streamId);
    } else if (msg.type === 'stream_error') {
      this._ended = true;
      const err = new Error(msg.error ?? 'stream error');
      (err as any).code = msg.code;
      for (const h of [...this.errorHandlers]) {
        try { h(err); } catch {}
      }
      this.transport._removeStream(this.streamId);
    }
  }
}

// ── Encoding helpers ─────────────────────────────────────────────────────

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}
