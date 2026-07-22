/**
 * CoAP Edge Gateway — wires a CoapTransportPort into an EdgeRuntime.
 */

import type { EdgeRuntime, EdgeOperationResult } from '@totemsdk/edge';
import type { CoapTransportPort, CoapMessage } from './transport.js';

export interface CoapGatewayConfig {
  runtime: EdgeRuntime;
  transport: CoapTransportPort;
  localPort: number;
}

export interface CoapGateway {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly status: 'stopped' | 'running' | 'error';
  get(path: string[], host: string, port: number): Promise<EdgeOperationResult<{ payload: Uint8Array }>>;
  post(path: string[], payload: Uint8Array, host: string, port: number): Promise<EdgeOperationResult<{ payload: Uint8Array }>>;
}

export function createCoapGateway(config: CoapGatewayConfig): CoapGateway {
  let status: 'stopped' | 'running' | 'error' = 'stopped';
  let unsubMsg: (() => void) | undefined;
  let unsubErr: (() => void) | undefined;
  const pending = new Map<number, { resolve: (v: Uint8Array) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  let nextId = 0;

  return {
    get status() { return status; },

    async start(): Promise<void> {
      if (status === 'running') return;
      await config.transport.bind(config.localPort);
      unsubMsg = config.transport.onMessage((raw, remote) => {
        try {
          const msg = decodeCoap(raw, remote);
          if (msg.type === 'ACK' && msg.token.length > 0) {
            const tokenId = new DataView(msg.token.buffer, msg.token.byteOffset, 4).getUint32(0, false);
            const p = pending.get(tokenId);
            if (p) { clearTimeout(p.timer); pending.delete(tokenId); p.resolve(msg.payload); }
          }
        } catch { /* drop */ }
      });
      unsubErr = config.transport.onError(() => { status = 'error'; });
      status = 'running';
    },

    async stop(): Promise<void> {
      unsubMsg?.(); unsubErr?.();
      for (const [, p] of pending) { clearTimeout(p.timer); p.reject(new Error('Gateway stopped')); }
      pending.clear();
      await config.transport.close();
      status = 'stopped';
    },

    async get(path, host, port) {
      return coapRequest(config.transport, 'GET', path, new Uint8Array(0), host, port, pending, nextId++);
    },

    async post(path, payload, host, port) {
      return coapRequest(config.transport, 'POST', path, payload, host, port, pending, nextId++);
    },
  };
}

async function coapRequest(
  transport: CoapTransportPort,
  method: 'GET' | 'POST',
  path: string[],
  payload: Uint8Array,
  host: string,
  port: number,
  pending: Map<number, { resolve: (v: Uint8Array) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>,
  messageId: number,
  timeoutMs = 10_000,
): Promise<EdgeOperationResult<{ payload: Uint8Array }>> {
  const token = new Uint8Array(4);
  new DataView(token.buffer).setUint32(0, messageId, false);
  const frame = encodeCoap({ type: 'CON', method, messageId, token, path, payload, remote: { host, port }, receivedAt: Date.now() });
  await transport.send(host, port, frame);
  return new Promise<EdgeOperationResult<{ payload: Uint8Array }>>((resolve) => {
    const timer = setTimeout(() => { pending.delete(messageId); resolve({ ok: false, error: 'CoAP request timed out' }); }, timeoutMs);
    pending.set(messageId, { resolve: (v) => resolve({ ok: true, data: { payload: v } }), reject: (e) => resolve({ ok: false, error: e.message }), timer });
  });
}

function encodeCoap(msg: CoapMessage): Uint8Array {
  const pathBytes = msg.path.map(p => [11, ...new TextEncoder().encode(p)]).flat();
  const tokenLen = Math.min(msg.token.length, 8);
  const header = new Uint8Array(4 + tokenLen);
  header[0] = 0x40 | (msg.type === 'CON' ? 0 : msg.type === 'NON' ? 0x10 : msg.type === 'ACK' ? 0x20 : 0x30);
  header[0] |= tokenLen;
  header[1] = msg.method === 'GET' ? 1 : msg.method === 'POST' ? 2 : msg.method === 'PUT' ? 3 : 4;
  new DataView(header.buffer).setUint16(2, msg.messageId, false);
  header.set(msg.token.slice(0, tokenLen), 4);
  const options = new Uint8Array(pathBytes.length + 1);
  options.set(new Uint8Array(pathBytes), 0);
  options[pathBytes.length] = 0xFF;
  const result = new Uint8Array(header.length + options.length + msg.payload.length);
  result.set(header); result.set(options, header.length); result.set(msg.payload, header.length + options.length);
  return result;
}

function decodeCoap(raw: Uint8Array, remote: { host: string; port: number }): CoapMessage {
  const tokenLen = raw[0] & 0x0F;
  const typeCode = (raw[0] >> 4) & 0x03;
  const type = typeCode === 0 ? 'CON' : typeCode === 1 ? 'NON' : typeCode === 2 ? 'ACK' : 'RST';
  const code = raw[1];
  const messageId = new DataView(raw.buffer, raw.byteOffset + 2, 2).getUint16(0, false);
  const token = raw.slice(4, 4 + tokenLen);
  let offset = 4 + tokenLen;
  const path: string[] = [];
  while (offset < raw.length && raw[offset] !== 0xFF) {
    const delta = (raw[offset] >> 4) & 0x0F;
    const len = raw[offset] & 0x0F;
    offset++;
    if (delta === 11) path.push(new TextDecoder().decode(raw.slice(offset, offset + len)));
    offset += len;
  }
  if (offset < raw.length && raw[offset] === 0xFF) offset++;
  const payload = raw.slice(offset);
  return { type, messageId, token, path, payload, remote, receivedAt: Date.now() };
}
