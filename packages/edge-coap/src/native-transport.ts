/**
 * NativeCoapTransport — connects to the edge-coap Go binary over TCP.
 *
 * The Go binary listens on a local TCP socket (default 127.0.0.1:15003)
 * and accepts newline-delimited JSON requests. This class implements
 * CoapTransportPort by forwarding all calls to the Go process.
 */

import type { CoapTransportPort } from './transport.js';

export interface NativeCoapConfig {
  host?: string;
  port?: number;
  connectTimeoutMs?: number;
  requestTimeoutMs?: number;
}

interface Request {
  id: string;
  host: string;
  port: number;
  data: string;
}

interface Response {
  id: string;
  ok: boolean;
  data?: string;
  error?: string;
}

interface PushMessage {
  type: string;
  host: string;
  port: number;
  data: string;
}

let requestCounter = 0;

export class NativeCoapTransport implements CoapTransportPort {
  private socket: ReturnType<typeof import('net').createConnection> | null = null;
  private buffer = '';
  private pending = new Map<string, { resolve: () => void; reject: (err: Error) => void }>();
  private messageHandlers: Array<(message: Uint8Array, remote: { host: string; port: number }) => void> = [];
  private errorHandlers: Array<(err: Error) => void> = [];
  private readonly config: Required<NativeCoapConfig>;

  constructor(config: NativeCoapConfig = {}) {
    this.config = {
      host: config.host ?? '127.0.0.1',
      port: config.port ?? 15003,
      connectTimeoutMs: config.connectTimeoutMs ?? 5000,
      requestTimeoutMs: config.requestTimeoutMs ?? 10000,
    };
  }

  async bind(_port: number): Promise<void> {
    const net = await import('net');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket?.destroy();
        reject(new Error(`NativeCoapTransport: connect timeout`));
      }, this.config.connectTimeoutMs);

      this.socket = net.createConnection({ host: this.config.host, port: this.config.port }, () => {
        clearTimeout(timer);
        resolve();
      });

      this.socket.on('data', (chunk: Buffer) => {
        this.buffer += chunk.toString('utf-8');
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.type === 'message') {
              const push = msg as PushMessage;
              const data = hexToBytes(push.data);
              for (const handler of this.messageHandlers) {
                try { handler(data, { host: push.host, port: push.port }); } catch {}
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
    if (this.socket) { this.socket.destroy(); this.socket = null; }
  }

  async send(host: string, port: number, message: Uint8Array): Promise<void> {
    if (!this.socket) throw new Error('NativeCoapTransport: not connected');
    const id = `coap-${++requestCounter}`;
    const req: Request = { id, host, port, data: bytesToHex(message) };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`NativeCoapTransport: request ${id} timed out`));
      }, this.config.requestTimeoutMs);

      this.pending.set(id, {
        resolve: () => { clearTimeout(timer); resolve(); },
        reject: (err) => { clearTimeout(timer); reject(err); },
      });

      this.socket!.write(JSON.stringify(req) + '\n');
    });
  }

  onMessage(handler: (message: Uint8Array, remote: { host: string; port: number }) => void): () => void {
    this.messageHandlers.push(handler);
    return () => { this.messageHandlers = this.messageHandlers.filter(h => h !== handler); };
  }

  onError(handler: (err: Error) => void): () => void {
    this.errorHandlers.push(handler);
    return () => { this.errorHandlers = this.errorHandlers.filter(h => h !== handler); };
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
