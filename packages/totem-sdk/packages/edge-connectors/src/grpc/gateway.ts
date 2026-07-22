import type { EdgeRuntime, EdgeOperationResult } from '@totemsdk/edge';
import type { GrpcTransportPort, GrpcMessage } from './transport.js';

export interface GrpcGatewayConfig {
  runtime: EdgeRuntime;
  transport: GrpcTransportPort;
}

export interface GrpcGateway {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly status: 'stopped' | 'running' | 'error';
  call(path: string, payload: Uint8Array, timeoutMs?: number): Promise<EdgeOperationResult<{ payload: Uint8Array }>>;
}

function encodeGrpcFrame(msg: GrpcMessage): Uint8Array {
  const header = JSON.stringify({ path: msg.path, requestId: msg.requestId, isResponse: msg.isResponse });
  const headerBytes = new TextEncoder().encode(header);
  const frame = new Uint8Array(5 + headerBytes.length + msg.payload.length);
  frame[0] = 0;
  new DataView(frame.buffer).setUint32(1, headerBytes.length + msg.payload.length, false);
  frame.set(headerBytes, 5);
  frame.set(msg.payload, 5 + headerBytes.length);
  return frame;
}

function decodeGrpcFrame(data: Uint8Array): GrpcMessage {
  const bodyLen = new DataView(data.buffer, data.byteOffset + 1, 4).getUint32(0, false);
  const body = data.slice(5, 5 + bodyLen);
  let headerEnd = 0;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === 0) { headerEnd = i; break; }
  }
  const header = JSON.parse(new TextDecoder().decode(body.slice(0, headerEnd)));
  return {
    path: header.path,
    payload: body.slice(headerEnd + 1),
    isResponse: header.isResponse,
    requestId: header.requestId,
    receivedAt: Date.now(),
  };
}

export function createGrpcGateway(config: GrpcGatewayConfig): GrpcGateway {
  let status: 'stopped' | 'running' | 'error' = 'stopped';
  const pending = new Map<string, { resolve: (v: Uint8Array) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  let nextId = 0;

  return {
    get status() { return status; },

    async start(): Promise<void> {
      if (status === 'running') return;
      config.transport.on('data', (chunk: unknown) => {
        try {
          const msg = decodeGrpcFrame(chunk as Uint8Array);
          if (msg.isResponse && msg.requestId) {
            const p = pending.get(msg.requestId);
            if (p) {
              clearTimeout(p.timer);
              pending.delete(msg.requestId);
              p.resolve(msg.payload);
            }
          }
        } catch { /* drop */ }
      });
      config.transport.on('close', () => { status = 'stopped'; });
      config.transport.on('error', () => { status = 'error'; });
      status = 'running';
    },

    async stop(): Promise<void> {
      for (const [, p] of pending) { clearTimeout(p.timer); p.reject(new Error('Gateway stopped')); }
      pending.clear();
      config.transport.close();
      status = 'stopped';
    },

    async call(path, payload, timeoutMs = 10_000) {
      const requestId = String(nextId++);
      const frame = encodeGrpcFrame({ path, payload, isResponse: false, requestId, receivedAt: Date.now() });
      config.transport.send(frame);
      return new Promise<EdgeOperationResult<{ payload: Uint8Array }>>((resolve) => {
        const timer = setTimeout(() => {
          pending.delete(requestId);
          resolve({ ok: false, error: 'gRPC call timed out' });
        }, timeoutMs);
        pending.set(requestId, {
          resolve: (v) => resolve({ ok: true, data: { payload: v } }),
          reject: (e) => resolve({ ok: false, error: e.message }),
          timer,
        });
      });
    },
  };
}
