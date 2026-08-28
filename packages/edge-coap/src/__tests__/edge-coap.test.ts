import { createCoapGateway } from '../gateway.js';
import { createCoapSensorBridge } from '../sensor-bridge.js';
import type { CoapTransportPort } from '../transport.js';
import type { EdgeRuntime } from '@totemsdk/edge';

class MockCoapTransport implements CoapTransportPort {
  boundPorts: number[] = [];
  closeCalls = 0;
  sent: Array<{ host: string; port: number; message: Uint8Array }> = [];
  failBind = false;
  messageHandlers: Array<(message: Uint8Array, remote: { host: string; port: number }) => void> = [];
  errorHandlers: Array<(err: Error) => void> = [];

  async bind(port: number) { if (this.failBind) throw new Error('bind failed'); this.boundPorts.push(port); }
  async close() { this.closeCalls++; }
  async send(host: string, port: number, message: Uint8Array) { this.sent.push({ host, port, message }); }
  onMessage(handler: (message: Uint8Array, remote: { host: string; port: number }) => void) { this.messageHandlers.push(handler); return () => { this.messageHandlers = this.messageHandlers.filter(h => h !== handler); }; }
  onError(handler: (err: Error) => void) { this.errorHandlers.push(handler); return () => { this.errorHandlers = this.errorHandlers.filter(h => h !== handler); }; }
  emitMessage(message: Uint8Array, remote: { host: string; port: number }) { for (const h of this.messageHandlers) h(message, remote); }
  emitError(err: Error) { for (const h of this.errorHandlers) h(err); }
}

function makeRuntime(proof?: { createProof: jest.Mock }) {
  return { deviceId: 'd1', capabilities: {}, ports: { proof } } as unknown as EdgeRuntime;
}

function makeProof() {
  return { createProof: jest.fn(async () => ({ ok: true, data: { proofId: 'p1', proof: {} } })) };
}

function ackFor(request: Uint8Array, payload: Uint8Array, code = 0x45): Uint8Array {
  const tokenLen = request[0] & 0x0F;
  const out = new Uint8Array(4 + tokenLen + 1 + payload.length);
  out[0] = 0x20 | tokenLen;
  out[1] = code;
  out[2] = request[2];
  out[3] = request[3];
  out.set(request.slice(4, 4 + tokenLen), 4);
  out[4 + tokenLen] = 0xFF;
  out.set(payload, 5 + tokenLen);
  return out;
}

describe('edge-coap gateway', () => {
  it('start binds the local port and reports running status', async () => {
    const transport = new MockCoapTransport();
    const gw = createCoapGateway({ runtime: makeRuntime(), transport, localPort: 5683 });
    expect(gw.status).toBe('stopped');
    await gw.start();
    expect(transport.boundPorts).toEqual([5683]);
    expect(gw.status).toBe('running');
  });

  it('start is a no-op when already running', async () => {
    const transport = new MockCoapTransport();
    const gw = createCoapGateway({ runtime: makeRuntime(), transport, localPort: 5683 });
    await gw.start();
    await gw.start();
    expect(transport.boundPorts).toHaveLength(1);
  });

  it('start propagates bind failures', async () => {
    const transport = new MockCoapTransport();
    transport.failBind = true;
    const gw = createCoapGateway({ runtime: makeRuntime(), transport, localPort: 5683 });
    await expect(gw.start()).rejects.toThrow('bind failed');
  });

  it('stop closes the socket and rejects pending requests', async () => {
    const transport = new MockCoapTransport();
    const gw = createCoapGateway({ runtime: makeRuntime(), transport, localPort: 5683 });
    await gw.start();
    const pending = gw.get(['sensors', 'temp'], '10.0.0.1', 5683);
    await Promise.resolve();
    await gw.stop();
    const result = await pending;
    expect(transport.closeCalls).toBe(1);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Gateway stopped');
  });

  it('get sends a CON GET with the URI path and resolves on ACK', async () => {
    const transport = new MockCoapTransport();
    const gw = createCoapGateway({ runtime: makeRuntime(), transport, localPort: 5683 });
    await gw.start();
    const promise = gw.get(['sensors', 'temp'], '10.0.0.1', 5683);
    const sent = transport.sent[0];
    expect(sent.host).toBe('10.0.0.1');
    expect(sent.port).toBe(5683);
    const header = sent.message;
    expect(header[0] & 0x30).toBe(0); // CON
    expect(header[1]).toBe(1);        // GET
    const decoded = new TextDecoder().decode(header);
    expect(decoded).toContain('sensors');
    expect(decoded).toContain('temp');
    await Promise.resolve();
    transport.emitMessage(ackFor(header, new Uint8Array([21, 5])), { host: '10.0.0.1', port: 5683 });
    const res = await promise;
    expect(res.ok).toBe(true);
    expect(Array.from((res as { data: { payload: Uint8Array } }).data.payload)).toEqual([21, 5]);
  });

  it('post sends a CON POST carrying the payload', async () => {
    const transport = new MockCoapTransport();
    const gw = createCoapGateway({ runtime: makeRuntime(), transport, localPort: 5683 });
    await gw.start();
    const payload = new Uint8Array([1, 2, 3]);
    const promise = gw.post(['actuators', 'pump'], payload, '10.0.0.1', 5683);
    const header = transport.sent[0].message;
    expect(header[1]).toBe(2); // POST
    expect(header.slice(-3)).toEqual(new Uint8Array([1, 2, 3]));
    await Promise.resolve();
    transport.emitMessage(ackFor(header, new Uint8Array([0])), { host: '10.0.0.1', port: 5683 });
    const res = await promise;
    expect(res.ok).toBe(true);
  });

  it('get resolves ok:false on timeout', async () => {
    jest.useFakeTimers();
    const transport = new MockCoapTransport();
    const gw = createCoapGateway({ runtime: makeRuntime(), transport, localPort: 5683 });
    await gw.start();
    const promise = gw.get(['sensors', 'temp'], '10.0.0.1', 5683);
    await jest.advanceTimersByTimeAsync(10000);
    const res = await promise;
    expect(res).toEqual({ ok: false, error: 'CoAP request timed out' });
    await gw.stop();
    jest.useRealTimers();
  });

  it('transport errors flip status to error', async () => {
    const transport = new MockCoapTransport();
    const gw = createCoapGateway({ runtime: makeRuntime(), transport, localPort: 5683 });
    await gw.start();
    transport.emitError(new Error('socket reset'));
    expect(gw.status).toBe('error');
    await gw.stop();
  });

  it('encodes a 4-byte token and sequential message ids', async () => {
    const transport = new MockCoapTransport();
    const gw = createCoapGateway({ runtime: makeRuntime(), transport, localPort: 5683 });
    await gw.start();
    const promise = gw.get(['a', 'b'], 'h', 1);
    const header = transport.sent[0].message;
    await Promise.resolve();
    expect(header[0] & 0x0F).toBe(4);
    expect(header[2] << 8 | header[3]).toBe(0);
    await gw.stop();
    await promise.catch(() => {});
  });
});

describe('edge-coap sensor bridge', () => {
  it('start polls each binding via the gateway and creates proofs', async () => {
    const transport = new MockCoapTransport();
    const proof = makeProof();
    const gateway = {
      get: jest.fn(async () => ({ ok: true, data: { payload: new Uint8Array([9, 9]) } })),
    };
    const bridge = createCoapSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      gateway: gateway as never,
      bindings: [{ sensorId: 'temp1', path: ['sensors', 'temp'], host: '10.0.0.1', port: 5683, intervalMs: 1000, dataType: 'temperature' }],
    });
    await bridge.poll();
    expect(gateway.get).toHaveBeenCalledWith(['sensors', 'temp'], '10.0.0.1', 5683);
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'sensor:temp1',
      claims: [expect.objectContaining({ sensorId: 'temp1', path: 'sensors/temp', dataType: 'temperature', payload: new Uint8Array([9, 9]) })],
    }));
  });

  it('poll is non-fatal when the gateway returns ok:false', async () => {
    const transport = new MockCoapTransport();
    const gateway = {
      get: jest.fn(async () => ({ ok: false, error: 'upstream down' })),
    };
    const bridge = createCoapSensorBridge({
      runtime: makeRuntime(makeProof()),
      transport,
      gateway: gateway as never,
      bindings: [{ sensorId: 'temp1', path: ['sensors', 'temp'], host: '10.0.0.1', port: 5683, intervalMs: 1000 }],
    });
    await expect(bridge.poll()).resolves.toBeUndefined();
  });

  it('stop clears scheduled polls', async () => {
    jest.useFakeTimers();
    const transport = new MockCoapTransport();
    const proof = makeProof();
    const gateway = {
      get: jest.fn(async () => ({ ok: true, data: { payload: new Uint8Array() } })),
    };
    const bridge = createCoapSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      gateway: gateway as never,
      bindings: [{ sensorId: 'temp1', path: ['sensors', 'temp'], host: '10.0.0.1', port: 5683, intervalMs: 1000 }],
    });
    const startPromise = bridge.start();
    await jest.advanceTimersByTimeAsync(0);
    await startPromise;
    const callsAfterStart = gateway.get.mock.calls.length;
    await bridge.stop();
    await jest.advanceTimersByTimeAsync(5000);
    expect(gateway.get.mock.calls.length).toBe(callsAfterStart);
    jest.useRealTimers();
  });
});