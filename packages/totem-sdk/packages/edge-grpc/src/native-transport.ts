/**
 * NativeGrpcTransport — connects to the edge-grpc Go binary over TCP.
 *
 * The Go binary listens on a local TCP socket (default 127.0.0.1:15005)
 * and accepts newline-delimited JSON requests. This class implements
 * GrpcTransportPort (IStreamTransport) by forwarding all calls to the Go process.
 */

import type { IStreamTransport } from '@totemsdk/stream-transport';

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
  data?: string;
}

interface Response {
  id: string;
  ok: boolean;
  data?: string;
  error?: string;
}

interface PushData {
  type: string;
  address: string;
  data: string;
}

type DataHandler = (chunk: Uint8Array) => void;
type CloseHandler = () => void;
type ErrorHandler = (err: Error) => void;

let requestCounter = 0;

export class NativeGrpcTransport implements IStreamTransport {
  private socket: ReturnType<typeof import('net').createConnection> | null = null;
  private buffer = '';
  private pending = new Map<string, { resolve: (data?: Uint8Array) => void; reject: (err: Error) => void }>();
  private dataHandlers: DataHandler[] = [];
  private closeHandlers: CloseHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];
  private readonly config: Required<NativeGrpcConfig>;
  private _connected = false;

  constructor(config: NativeGrpcConfig = {}) {
    this.config = {
      host: config.host ?? '127.0.0.1',
      port: config.port ?? 15005,
      connectTimeoutMs: config.connectTimeoutMs ?? 5000,
      requestTimeoutMs: config.requestTimeoutMs ?? 10000,
    };
  }

  async connect(address: string): Promise<void> {
    const net = await import('net');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket?.destroy();
        reject(new Error(`NativeGrpcTransport: connect timeout`));
      }, this.config.connectTimeoutMs);

      this.socket = net.createConnection({ host: this.config.host, port: this.config.port }, () => {
        clearTimeout(timer);
        this._connected = true;
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
            if (msg.type === 'data') {
              const push = msg as PushData;
              const data = hexToBytes(push.data);
              for (const handler of this.dataHandlers) {
                try { handler(data); } catch {}
              }
            } else if (msg.id && this.pending.has(msg.id)) {
              const { resolve: res, reject: rej } = this.pending.get(msg.id)!;
              this.pending.delete(msg.id);
              if (msg.ok) res(msg.data ? hexToBytes(msg.data) : undefined);
              else rej(new Error(msg.error ?? 'unknown error'));
            }
          } catch {}
        }
      });

      this.socket.on('error', (err: Error) => {
        for (const handler of this.errorHandlers) {
          try { handler(err); } catch {}
        }
      });

      this.socket.on('close', () => {
        this._connected = false;
        for (const [, p] of this.pending) p.reject(new Error('connection closed'));
        this.pending.clear();
        for (const handler of this.closeHandlers) {
          try { handler(); } catch {}
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.socket && this._connected) {
      try { await this.sendRequest('disconnect', {}); } catch {}
      this.socket.destroy();
      this.socket = null;
      this._connected = false;
    }
  }

  async send(data: Uint8Array): Promise<void> {
    await this.sendRequest('send', { data: bytesToHex(data) });
  }

  onData(handler: DataHandler): void {
    this.dataHandlers.push(handler);
  }

  onClose(handler: CloseHandler): void {
    this.closeHandlers.push(handler);
  }

  onError(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  close(): void {
    this.disconnect().catch(() => {});
  }

  private sendRequest(type: string, extra: Record<string, unknown>): Promise<Uint8Array | undefined> {
    if (!this.socket) throw new Error('NativeGrpcTransport: not connected');
    const id = `grpc-${++requestCounter}`;
    const req: Request = { id, type, ...extra } as Request;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`NativeGrpcTransport: request ${id} timed out`));
      }, this.config.requestTimeoutMs);

      this.pending.set(id, {
        resolve: (data) => { clearTimeout(timer); resolve(data); },
        reject: (err) => { clearTimeout(timer); reject(err); },
      });

      this.socket!.write(JSON.stringify(req) + '\n');
    });
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string');
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}
