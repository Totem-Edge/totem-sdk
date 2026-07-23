/**
 * NativeModbusTransport — connects to the edge-modbus Go binary over TCP.
 *
 * The Go binary listens on a local TCP socket (default 127.0.0.1:15002)
 * and accepts newline-delimited JSON requests. This class implements
 * ModbusTransportPort by forwarding all calls to the Go process.
 *
 * Usage:
 *   const transport = new NativeModbusTransport({ host: '127.0.0.1', port: 15002 });
 *   await transport.connect();
 *   const response = await transport.sendFrame(requestFrame);
 *   transport.disconnect();
 */

import type { ModbusTransportPort } from './transport.js';

export interface NativeModbusConfig {
  host?: string;
  port?: number;
  /** Connection timeout in ms. Default 5000. */
  connectTimeoutMs?: number;
  /** Per-request timeout in ms. Default 10000. */
  requestTimeoutMs?: number;
}

interface Request {
  id: string;
  frame: string;
}

interface Response {
  id: string;
  ok: boolean;
  frame?: string;
  error?: string;
}

let requestCounter = 0;

export class NativeModbusTransport implements ModbusTransportPort {
  private socket: ReturnType<typeof import('net').createConnection> | null = null;
  private buffer = '';
  private pending = new Map<string, { resolve: (data: Uint8Array) => void; reject: (err: Error) => void }>();
  private frameHandlers: Array<(frame: Uint8Array) => void> = [];
  private errorHandlers: Array<(err: Error) => void> = [];
  private readonly config: Required<NativeModbusConfig>;

  constructor(config: NativeModbusConfig = {}) {
    this.config = {
      host: config.host ?? '127.0.0.1',
      port: config.port ?? 15002,
      connectTimeoutMs: config.connectTimeoutMs ?? 5000,
      requestTimeoutMs: config.requestTimeoutMs ?? 10000,
    };
  }

  async connect(): Promise<void> {
    const net = await import('net');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket?.destroy();
        reject(new Error(`NativeModbusTransport: connect timeout (${this.config.connectTimeoutMs}ms)`));
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
            const msg = JSON.parse(line) as Response;
            if (msg.id && this.pending.has(msg.id)) {
              const { resolve: res, reject: rej } = this.pending.get(msg.id)!;
              this.pending.delete(msg.id);
              if (msg.ok && msg.frame) {
                res(hexToBytes(msg.frame));
              } else {
                rej(new Error(msg.error ?? 'unknown error'));
              }
            }
          } catch {
            // ignore parse errors on partial lines
          }
        }
      });

      this.socket.on('error', (err: Error) => {
        for (const handler of this.errorHandlers) {
          try { handler(err); } catch {}
        }
      });

      this.socket.on('close', () => {
        for (const [, pending] of this.pending) {
          pending.reject(new Error('NativeModbusTransport: connection closed'));
        }
        this.pending.clear();
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }

  async sendFrame(frame: Uint8Array): Promise<Uint8Array> {
    if (!this.socket) {
      throw new Error('NativeModbusTransport: not connected');
    }

    const id = `modbus-${++requestCounter}`;
    const request: Request = { id, frame: bytesToHex(frame) };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`NativeModbusTransport: request ${id} timed out (${this.config.requestTimeoutMs}ms)`));
      }, this.config.requestTimeoutMs);

      this.pending.set(id, {
        resolve: (data) => { clearTimeout(timer); resolve(data); },
        reject: (err) => { clearTimeout(timer); reject(err); },
      });

      this.socket!.write(JSON.stringify(request) + '\n');
    });
  }

  onFrame(handler: (frame: Uint8Array) => void): () => void {
    this.frameHandlers.push(handler);
    return () => {
      this.frameHandlers = this.frameHandlers.filter(h => h !== handler);
    };
  }

  onError(handler: (err: Error) => void): () => void {
    this.errorHandlers.push(handler);
    return () => {
      this.errorHandlers = this.errorHandlers.filter(h => h !== handler);
    };
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
