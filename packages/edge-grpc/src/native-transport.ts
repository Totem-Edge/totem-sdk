/**
 * NativeGrpcTransport — connects to the edge-grpc Go binary over TCP.
 *
 * The Go binary listens on a local TCP socket (default 127.0.0.1:15005) and
 * accepts newline-delimited JSON requests with base64-encoded protobuf
 * payloads. The binary owns the real gRPC/HTTP2 connection, raw-byte codec,
 * TLS and metadata authentication.
 */

import type { IStreamTransport } from '@totemsdk/stream-transport';
import type { GrpcStreamHandle, GrpcTlsConfig } from './transport.js';

export interface NativeGrpcConfig {
  host?: string;
  port?: number;
  connectTimeoutMs?: number;
  requestTimeoutMs?: number;
  /** TLS profile applied on connect. Omit for a plaintext local connection. */
  tls?: GrpcTlsConfig;
  /** HTTP/2 authority override. */
  authority?: string;
  /** Connection-level metadata, e.g. an authorization header. */
  metadata?: Record<string, string>;
}

interface Request {
  id: string;
  type: string;
  address?: string;
  path?: string;
  payload?: string;
  deadline_ms?: number;
  stream_id?: string;
  tls?: GrpcTlsConfig;
  authority?: string;
  metadata?: Record<string, string>;
  data?: string;
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
type StreamKind = 'server' | 'client' | 'bidi';

let requestCounter = 0;

function grpcError(message: string, code?: number): Error {
  const error = new Error(message);
  if (code !== undefined) (error as Error & { code?: number }).code = code;
  return error;
}

export class NativeGrpcTransport implements IStreamTransport {
  private socket: ReturnType<typeof import('net').createConnection> | null = null;
  private buffer = '';
  private pending = new Map<string, { resolve: (resp: Response) => void; reject: (err: Error) => void }>();
  private dataHandlers = new Set<DataHandler>();
  private closeHandlers = new Set<CloseHandler>();
  private errorHandlers = new Set<ErrorHandler>();
  private readonly config: Required<Omit<NativeGrpcConfig, 'tls' | 'authority' | 'metadata'>> & Pick<NativeGrpcConfig, 'tls' | 'authority' | 'metadata'>;
  private _state: 'connecting' | 'open' | 'closing' | 'closed' = 'connecting';
  private _closeResolve: (() => void) | null = null;
  private readonly _closePromise: Promise<void>;
  private streams = new Map<string, NativeGrpcStreamHandle>();
  private orphanPushes = new Map<string, PushMessage[]>();

  constructor(config: NativeGrpcConfig = {}) {
    this.config = {
      host: config.host ?? '127.0.0.1',
      port: config.port ?? 15005,
      connectTimeoutMs: config.connectTimeoutMs ?? 5000,
      requestTimeoutMs: config.requestTimeoutMs ?? 30000,
      tls: config.tls,
      authority: config.authority,
      metadata: config.metadata,
    };
    this._closePromise = new Promise((resolve) => { this._closeResolve = resolve; });
  }

  get state(): 'connecting' | 'open' | 'closing' | 'closed' {
    return this._state;
  }

  async connect(address?: string): Promise<void> {
    if (!address) throw new Error('NativeGrpcTransport: gRPC server address required');
    if (this._state === 'open') throw new Error('NativeGrpcTransport: already connected');
    const net = await import('net');
    this.buffer = '';
    return new Promise((resolve, reject) => {
      let connected = false;
      const timer = setTimeout(() => {
        this.socket?.destroy();
        this._state = 'closed';
        reject(new Error('NativeGrpcTransport: connect timeout'));
      }, this.config.connectTimeoutMs);

      this.socket = net.createConnection({ host: this.config.host, port: this.config.port }, () => {
        connected = true;
        this._state = 'open';
        this.sendRequest('connect', {
          address,
          ...(this.config.tls ? { tls: this.config.tls } : {}),
          ...(this.config.authority ? { authority: this.config.authority } : {}),
          ...(this.config.metadata ? { metadata: this.config.metadata } : {}),
        }).then(() => {
          clearTimeout(timer);
          resolve();
        }).catch((error) => {
          clearTimeout(timer);
          this._state = 'closed';
          this.socket?.destroy();
          reject(error);
        });
      });

      this.socket.on('data', (chunk: Buffer) => {
        this.buffer += chunk.toString('utf-8');
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line) as PushMessage & Response;
            if (msg.type === 'stream_data' || msg.type === 'stream_end' || msg.type === 'stream_error') {
              const stream = this.streams.get(msg.stream_id);
              if (stream) {
                stream._handlePush(msg);
              } else {
                // The stream-created response and first pushes can share a TCP
                // chunk; buffer pushes until createStream() registers the handle.
                const queued = this.orphanPushes.get(msg.stream_id) ?? [];
                queued.push(msg);
                this.orphanPushes.set(msg.stream_id, queued);
              }
            } else if (msg.id && this.pending.has(msg.id)) {
              const { resolve: res, reject: rej } = this.pending.get(msg.id)!;
              this.pending.delete(msg.id);
              if (msg.ok) res(msg);
              else rej(grpcError(msg.error ?? 'unknown error', msg.code));
            }
          } catch { /* malformed line is dropped */ }
        }
      });

      this.socket.on('error', (err: Error) => {
        if (!connected) {
          clearTimeout(timer);
          this._state = 'closed';
          this.socket?.destroy();
          reject(err);
        }
        this.emitError(err);
      });

      this.socket.on('close', () => {
        this._state = 'closed';
        for (const [, pending] of this.pending) pending.reject(new Error('connection closed'));
        this.pending.clear();
        for (const stream of [...this.streams.values()]) stream._handlePush({ type: 'stream_error', stream_id: stream.streamId, error: 'connection closed' });
        this.streams.clear();
        this.orphanPushes.clear();
        for (const handler of [...this.closeHandlers]) {
          try { handler(); } catch {}
        }
        this.closeHandlers.clear();
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

  async send(_data: Uint8Array): Promise<void> {
    throw new Error('NativeGrpcTransport: raw send is not supported; use unaryCall or a stream');
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

  private emitError(error: Error): void {
    for (const handler of [...this.errorHandlers]) {
      try { handler(error); } catch {}
    }
  }

  // ── gRPC operations ────────────────────────────────────────────────────

  async unaryCall(path: string, payload: Uint8Array, deadlineMs?: number): Promise<Uint8Array> {
    const response = await this.sendRequest('unary', {
      path,
      payload: bytesToBase64(payload),
      deadline_ms: deadlineMs ?? this.config.requestTimeoutMs,
    });
    return response.data ? base64ToBytes(response.data) : new Uint8Array(0);
  }

  async serverStream(path: string, payload: Uint8Array, deadlineMs?: number): Promise<GrpcStreamHandle> {
    const response = await this.sendRequest('server_stream', {
      path,
      payload: bytesToBase64(payload),
      deadline_ms: deadlineMs ?? this.config.requestTimeoutMs,
    });
    return this.createStream(response, 'server');
  }

  async clientStream(path: string, deadlineMs?: number): Promise<GrpcStreamHandle> {
    const response = await this.sendRequest('client_stream', {
      path,
      deadline_ms: deadlineMs ?? this.config.requestTimeoutMs,
    });
    return this.createStream(response, 'client');
  }

  async bidiStream(path: string, deadlineMs?: number): Promise<GrpcStreamHandle> {
    const response = await this.sendRequest('bidi_stream', {
      path,
      deadline_ms: deadlineMs ?? this.config.requestTimeoutMs,
    });
    return this.createStream(response, 'bidi');
  }

  private createStream(response: Response, kind: StreamKind): GrpcStreamHandle {
    const streamId = response.stream_id ?? '';
    if (!streamId) throw new Error('NativeGrpcTransport: sidecar did not return a stream id');
    const handle = new NativeGrpcStreamHandle(streamId, this, kind);
    this.streams.set(streamId, handle);
    const queued = this.orphanPushes.get(streamId);
    if (queued) {
      this.orphanPushes.delete(streamId);
      for (const message of queued) handle._handlePush(message);
    }
    return handle;
  }

  async streamSend(streamId: string, payload: Uint8Array): Promise<void> {
    await this.sendRequest('stream_send', { stream_id: streamId, payload: bytesToBase64(payload) });
  }

  async streamClose(streamId: string): Promise<void> {
    await this.sendRequest('stream_close', { stream_id: streamId });
  }

  async streamCancel(streamId: string): Promise<void> {
    await this.sendRequest('cancel_stream', { stream_id: streamId });
  }

  /** @internal */
  _removeStream(streamId: string): void {
    this.streams.delete(streamId);
  }

  private sendRequest(type: string, extra: Record<string, unknown>): Promise<Response> {
    if (!this.socket || this.socket.destroyed || this._state === 'closed') {
      return Promise.reject(new Error('NativeGrpcTransport: not connected'));
    }
    const id = `grpc-${++requestCounter}`;
    const request: Request = { id, type, ...extra } as Request;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`NativeGrpcTransport: request ${id} timed out`));
      }, this.config.requestTimeoutMs);

      this.pending.set(id, {
        resolve: (response) => { clearTimeout(timer); resolve(response); },
        reject: (error) => { clearTimeout(timer); reject(error); },
      });

      this.socket!.write(JSON.stringify(request) + '\n');
    });
  }
}

// ── Stream handle ─────────────────────────────────────────────────────────

class NativeGrpcStreamHandle implements GrpcStreamHandle {
  private dataHandlers = new Set<(payload: Uint8Array) => void>();
  private endHandlers = new Set<() => void>();
  private errorHandlers = new Set<(err: Error) => void>();
  private _ended = false;
  private _sendClosed = false;
  private _pendingData: Uint8Array[] = [];
  private _endPending = false;
  private _pendingError?: Error;

  constructor(
    readonly streamId: string,
    private transport: NativeGrpcTransport,
    private readonly kind: StreamKind,
  ) {}

  async send(payload: Uint8Array): Promise<void> {
    if (this._ended || this._sendClosed) throw new Error('NativeGrpcTransport: stream send side is closed');
    await this.transport.streamSend(this.streamId, payload);
  }

  async close(): Promise<void> {
    if (this._ended || this._sendClosed) return;
    if (this.kind === 'server') {
      // A server stream has no send side; closing cancels the RPC.
      this._ended = true;
      try {
        await this.transport.streamCancel(this.streamId);
      } finally {
        this.transport._removeStream(this.streamId);
      }
      return;
    }
    // Client/bidi: close only the send side and keep receiving the response.
    this._sendClosed = true;
    await this.transport.streamClose(this.streamId);
  }

  onData(handler: (payload: Uint8Array) => void): () => void {
    this.dataHandlers.add(handler);
    // Data can arrive between the sidecar's stream-created response and the
    // caller attaching handlers; replay what was buffered.
    const buffered = this._pendingData;
    this._pendingData = [];
    for (const payload of buffered) {
      try { handler(payload); } catch {}
    }
    return () => { this.dataHandlers.delete(handler); };
  }

  onEnd(handler: () => void): () => void {
    this.endHandlers.add(handler);
    if (this._endPending) { this._endPending = false; try { handler(); } catch {} }
    return () => { this.endHandlers.delete(handler); };
  }

  onError(handler: (err: Error) => void): () => void {
    this.errorHandlers.add(handler);
    if (this._pendingError) {
      const error = this._pendingError;
      this._pendingError = undefined;
      try { handler(error); } catch {}
    }
    return () => { this.errorHandlers.delete(handler); };
  }

  /** @internal */
  _handlePush(msg: PushMessage): void {
    if (msg.type === 'stream_data' && msg.payload) {
      this.deliver(base64ToBytes(msg.payload));
      return;
    }
    if (msg.type === 'stream_end') {
      if (msg.payload) this.deliver(base64ToBytes(msg.payload));
      this.finish();
      return;
    }
    if (msg.type === 'stream_error') {
      if (this._ended) return;
      this._ended = true;
      const error = grpcError(msg.error ?? 'stream error', msg.code);
      if (this.errorHandlers.size === 0) this._pendingError = error;
      for (const handler of [...this.errorHandlers]) {
        try { handler(error); } catch {}
      }
      this.transport._removeStream(this.streamId);
    }
  }

  private deliver(payload: Uint8Array): void {
    if (this.dataHandlers.size === 0) {
      this._pendingData.push(payload);
      return;
    }
    for (const handler of [...this.dataHandlers]) {
      try { handler(payload); } catch {}
    }
  }

  private finish(): void {
    if (this._ended) return;
    this._ended = true;
    if (this.endHandlers.size === 0) this._endPending = true;
    for (const handler of [...this.endHandlers]) {
      try { handler(); } catch {}
    }
    this.transport._removeStream(this.streamId);
  }
}

// ── Encoding helpers ──────────────────────────────────────────────────────

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(encoded: string): Uint8Array {
  return new Uint8Array(Buffer.from(encoded, 'base64'));
}
