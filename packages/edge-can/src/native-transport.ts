/**
 * NativeCanTransport — connects to the edge-can Go binary over TCP.
 *
 * The Go binary listens on a local TCP socket (default 127.0.0.1:15004)
 * and accepts newline-delimited JSON requests. This class implements
 * CanTransportPort by forwarding all calls to the Go process.
 */

import type { CanTransportPort, CanFrame } from './transport.js';

export interface NativeCanConfig {
  host?: string;
  port?: number;
  connectTimeoutMs?: number;
  requestTimeoutMs?: number;
}

interface Request {
  id: string;
  type: string;
  interface?: string;
  canId?: number;
  isExtended?: boolean;
  data?: string;
}

interface Response {
  id: string;
  ok: boolean;
  error?: string;
}

interface PushFrame {
  type: string;
  id: number;
  isExtended: boolean;
  isRtr: boolean;
  dlc: number;
  data: string;
  timestamp: number;
}

let requestCounter = 0;

export class NativeCanTransport implements CanTransportPort {
  private socket: ReturnType<typeof import('net').createConnection> | null = null;
  private buffer = '';
  private pending = new Map<string, { resolve: () => void; reject: (err: Error) => void }>();
  private frameHandlers: Array<(frame: CanFrame) => void> = [];
  private errorHandlers: Array<(err: Error) => void> = [];
  private readonly config: Required<NativeCanConfig>;

  constructor(config: NativeCanConfig = {}) {
    this.config = {
      host: config.host ?? '127.0.0.1',
      port: config.port ?? 15004,
      connectTimeoutMs: config.connectTimeoutMs ?? 5000,
      requestTimeoutMs: config.requestTimeoutMs ?? 10000,
    };
  }

  async open(interfaceName: string): Promise<void> {
    const net = await import('net');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket?.destroy();
        reject(new Error(`NativeCanTransport: connect timeout`));
      }, this.config.connectTimeoutMs);

      this.socket = net.createConnection({ host: this.config.host, port: this.config.port }, () => {
        clearTimeout(timer);
        this.sendRequest('open', { interface: interfaceName }).then(resolve).catch(reject);
      });

      this.socket.on('data', (chunk: Buffer) => {
        this.buffer += chunk.toString('utf-8');
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.type === 'frame') {
              const push = msg as PushFrame;
              const frame: CanFrame = {
                id: push.id,
                isExtended: push.isExtended,
                isRtr: push.isRtr,
                dlc: push.dlc,
                data: hexToBytes(push.data),
                receivedAt: push.timestamp,
              };
              for (const handler of this.frameHandlers) {
                try { handler(frame); } catch {}
              }
            } else if (msg.id && this.pending.has(msg.id)) {
              const { resolve: res, reject: rej } = this.pending.get(msg.id)!;
              this.pending.delete(msg.id);
              if (msg.ok) res();
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
        for (const [, p] of this.pending) p.reject(new Error('connection closed'));
        this.pending.clear();
      });
    });
  }

  async close(): Promise<void> {
    if (this.socket) {
      await this.sendRequest('close', {});
      this.socket.destroy();
      this.socket = null;
    }
  }

  async send(id: number, data: Uint8Array, isExtended: boolean): Promise<void> {
    await this.sendRequest('send', { canId: id, isExtended, data: bytesToHex(data) });
  }

  onFrame(handler: (frame: CanFrame) => void): () => void {
    this.frameHandlers.push(handler);
    return () => { this.frameHandlers = this.frameHandlers.filter(h => h !== handler); };
  }

  onError(handler: (err: Error) => void): () => void {
    this.errorHandlers.push(handler);
    return () => { this.errorHandlers = this.errorHandlers.filter(h => h !== handler); };
  }

  private sendRequest(type: string, extra: Record<string, unknown>): Promise<void> {
    if (!this.socket) throw new Error('NativeCanTransport: not connected');
    const id = `can-${++requestCounter}`;
    const req: Request = { id, type, ...extra } as Request;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`NativeCanTransport: request ${id} timed out`));
      }, this.config.requestTimeoutMs);

      this.pending.set(id, {
        resolve: () => { clearTimeout(timer); resolve(); },
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
