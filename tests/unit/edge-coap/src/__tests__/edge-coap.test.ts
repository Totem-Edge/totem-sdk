import { createCoapGateway } from '../gateway.js';
import { createCoapSensorBridge } from '../sensor-bridge.js';
import { decodeCoap, encodeCoap } from '../codec.js';
import { NativeCoapTransport } from '../native-transport.js';
import { createServer } from 'node:net';
import type { AddressInfo, Socket } from 'node:net';
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
  out[0] = 0x60 | tokenLen; // Ver=1, Type=ACK
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

  it('assembles a Block2 response across multiple requests', async () => {
    const transport = new MockCoapTransport();
    const gw = createCoapGateway({
      runtime: makeRuntime(), transport, localPort: 5683,
      timing: { requestTimeoutMs: 1000, ackTimeoutMs: 0 },
      blockwise: { blockSize: 16 },
    });
    await gw.start();
    const pending = gw.get(['large'], '10.0.0.1', 5683);
    await new Promise((resolve) => setImmediate(resolve));

    const first = transport.sent[0].message;
    const firstToken = first.slice(4, 8);
    const firstId = (first[2] << 8) | first[3];
    const block0 = Uint8Array.from({ length: 16 }, (_, index) => index);
    transport.emitMessage(encodeCoap({
      type: 'ACK', responseCode: '2.05', messageId: firstId, token: firstToken, path: [],
      payload: block0, block2: { num: 0, more: true, sizeExponent: 0 },
      remote: { host: '10.0.0.1', port: 5683 }, receivedAt: 0,
    }), { host: '10.0.0.1', port: 5683 });
    await new Promise((resolve) => setImmediate(resolve));

    expect(transport.sent).toHaveLength(2);
    const second = transport.sent[1].message;
    const continuation = decodeCoap(second, { host: '10.0.0.1', port: 5683 });
    expect(continuation.block2).toEqual({ num: 1, more: false, sizeExponent: 0 });
    const secondId = (second[2] << 8) | second[3];
    const block1 = Uint8Array.from({ length: 5 }, (_, index) => 100 + index);
    transport.emitMessage(encodeCoap({
      type: 'ACK', responseCode: '2.05', messageId: secondId, token: second.slice(4, 8), path: [],
      payload: block1, block2: { num: 1, more: false, sizeExponent: 0 },
      remote: { host: '10.0.0.1', port: 5683 }, receivedAt: 0,
    }), { host: '10.0.0.1', port: 5683 });

    const result = await pending;
    expect(result.ok).toBe(true);
    expect(Array.from((result as { data: { payload: Uint8Array } }).data.payload)).toEqual([...block0, ...block1]);
    await gw.stop();
  });

  it('uploads a large POST as Block1 requests', async () => {
    const transport = new MockCoapTransport();
    const gw = createCoapGateway({
      runtime: makeRuntime(), transport, localPort: 5683,
      timing: { requestTimeoutMs: 1000, ackTimeoutMs: 0 },
      blockwise: { blockSize: 16 },
    });
    await gw.start();
    const payload = Uint8Array.from({ length: 40 }, (_, index) => index);
    const pending = gw.post(['upload'], payload, '10.0.0.1', 5683);

    for (let num = 0; num < 3; num++) {
      await new Promise((resolve) => setImmediate(resolve));
      const sent = transport.sent[num].message;
      const request = decodeCoap(sent, { host: '10.0.0.1', port: 5683 });
      expect(request.block1).toEqual({ num, more: num < 2, sizeExponent: 0 });
      expect(request.size1).toBe(40);
      transport.emitMessage(encodeCoap({
        type: 'ACK', responseCode: num < 2 ? '2.31' : '2.04',
        messageId: request.messageId, token: request.token, path: [], payload: new Uint8Array(0),
        block1: { num, more: num < 2, sizeExponent: 0 },
        remote: { host: '10.0.0.1', port: 5683 }, receivedAt: 0,
      }), { host: '10.0.0.1', port: 5683 });
    }

    const result = await pending;
    expect(result.ok).toBe(true);
    expect(transport.sent).toHaveLength(3);
    await gw.stop();
  });

  it('restarts a Block1 upload when the server reduces the block size', async () => {
    const transport = new MockCoapTransport();
    const gw = createCoapGateway({
      runtime: makeRuntime(), transport, localPort: 5683,
      timing: { requestTimeoutMs: 1000, ackTimeoutMs: 0 },
      blockwise: { blockSize: 32 },
    });
    await gw.start();
    const pending = gw.post(['upload'], Uint8Array.from({ length: 40 }, (_, index) => index), '10.0.0.1', 5683);
    const tick = () => new Promise((resolve) => setImmediate(resolve));

    await tick();
    const first = decodeCoap(transport.sent[0].message, { host: '10.0.0.1', port: 5683 });
    expect(first.block1).toEqual({ num: 0, more: true, sizeExponent: 1 });
    transport.emitMessage(encodeCoap({
      type: 'ACK', responseCode: '2.31', messageId: first.messageId, token: first.token, path: [],
      payload: new Uint8Array(0), block1: { num: 0, more: true, sizeExponent: 0 },
      remote: { host: '10.0.0.1', port: 5683 }, receivedAt: 0,
    }), { host: '10.0.0.1', port: 5683 });

    for (let num = 0; num < 3; num++) {
      await tick();
      const request = decodeCoap(transport.sent[num + 1].message, { host: '10.0.0.1', port: 5683 });
      expect(request.block1).toEqual({ num, more: num < 2, sizeExponent: 0 });
      transport.emitMessage(encodeCoap({
        type: 'ACK', responseCode: num < 2 ? '2.31' : '2.04',
        messageId: request.messageId, token: request.token, path: [], payload: new Uint8Array(0),
        block1: { num, more: num < 2, sizeExponent: 0 },
        remote: { host: '10.0.0.1', port: 5683 }, receivedAt: 0,
      }), { host: '10.0.0.1', port: 5683 });
    }

    const result = await pending;
    expect(result.ok).toBe(true);
    expect(transport.sent).toHaveLength(4);
    await gw.stop();
  });

  it('fails a blockwise upload when the server does not acknowledge a block', async () => {
    const transport = new MockCoapTransport();
    const gw = createCoapGateway({
      runtime: makeRuntime(), transport, localPort: 5683,
      timing: { requestTimeoutMs: 1000, ackTimeoutMs: 0 },
      blockwise: { blockSize: 16 },
    });
    await gw.start();
    const pending = gw.post(['upload'], new Uint8Array(40), '10.0.0.1', 5683);
    await new Promise((resolve) => setImmediate(resolve));
    const request = decodeCoap(transport.sent[0].message, { host: '10.0.0.1', port: 5683 });
    transport.emitMessage(encodeCoap({
      type: 'ACK', responseCode: '2.31', messageId: request.messageId, token: request.token,
      path: [], payload: new Uint8Array(0),
      remote: { host: '10.0.0.1', port: 5683 }, receivedAt: 0,
    }), { host: '10.0.0.1', port: 5683 });

    const result = await pending;
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/did not acknowledge/);
    await gw.stop();
  });

  it('rejects a blockwise response above maxBodySize', async () => {
    const transport = new MockCoapTransport();
    const gw = createCoapGateway({
      runtime: makeRuntime(), transport, localPort: 5683,
      timing: { requestTimeoutMs: 1000, ackTimeoutMs: 0 },
      blockwise: { blockSize: 16, maxBodySize: 20 },
    });
    await gw.start();
    const pending = gw.get(['large'], '10.0.0.1', 5683);
    await new Promise((resolve) => setImmediate(resolve));
    const first = decodeCoap(transport.sent[0].message, { host: '10.0.0.1', port: 5683 });
    transport.emitMessage(encodeCoap({
      type: 'ACK', responseCode: '2.05', messageId: first.messageId, token: first.token, path: [],
      payload: new Uint8Array(16), block2: { num: 0, more: true, sizeExponent: 0 },
      remote: { host: '10.0.0.1', port: 5683 }, receivedAt: 0,
    }), { host: '10.0.0.1', port: 5683 });
    await new Promise((resolve) => setImmediate(resolve));
    const second = decodeCoap(transport.sent[1].message, { host: '10.0.0.1', port: 5683 });
    transport.emitMessage(encodeCoap({
      type: 'ACK', responseCode: '2.05', messageId: second.messageId, token: second.token, path: [],
      payload: new Uint8Array(16), block2: { num: 1, more: false, sizeExponent: 0 },
      remote: { host: '10.0.0.1', port: 5683 }, receivedAt: 0,
    }), { host: '10.0.0.1', port: 5683 });

    const result = await pending;
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/maxBodySize/);
    await gw.stop();
  });

  it('transport errors flip status to error', async () => {
    const transport = new MockCoapTransport();
    const gw = createCoapGateway({ runtime: makeRuntime(), transport, localPort: 5683 });
    await gw.start();
    transport.emitError(new Error('socket reset'));
    expect(gw.status).toBe('error');
    await gw.stop();
  });

  it('settles pending requests on transport error and recovers to running on a later response', async () => {
    const transport = new MockCoapTransport();
    const gw = createCoapGateway({
      runtime: makeRuntime(), transport, localPort: 5683,
      timing: { requestTimeoutMs: 1000, ackTimeoutMs: 0 },
    });
    await gw.start();

    const pending = gw.get(['sensors'], '10.0.0.1', 5683);
    transport.emitError(new Error('sidecar gone'));
    const failed = await pending;
    expect(failed.ok).toBe(false);
    expect(failed.error).toContain('CoAP transport error');
    expect(gw.status).toBe('error');

    const retry = gw.get(['sensors'], '10.0.0.1', 5683);
    const request = transport.sent[1].message;
    transport.emitMessage(ackFor(request, new Uint8Array([1])), { host: '10.0.0.1', port: 5683 });
    const result = await retry;
    expect(result.ok).toBe(true);
    expect(gw.status).toBe('running');
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

  it('decodes CBOR payloads into structured claims', async () => {
    const transport = new MockCoapTransport();
    const proof = makeProof();
    const payload = new Uint8Array(Buffer.from('a16474656d70fb4035800000000000', 'hex'));
    const gateway = {
      get: jest.fn(async () => ({ ok: true, data: { payload, contentFormat: 60 } })),
    };
    const bridge = createCoapSensorBridge({
      runtime: makeRuntime(proof), transport, gateway: gateway as never,
      bindings: [{ sensorId: 'temp1', path: ['sensors', 'temp'], host: '10.0.0.1', port: 5683, intervalMs: 1000 }],
    });
    await bridge.poll();
    const claim = proof.createProof.mock.calls[0][0].claims[0];
    expect(claim.contentFormat).toBe(60);
    expect(claim.cbor).toEqual({ temp: 21.5 });
  });

  it('does not sign malformed CBOR payloads', async () => {
    const transport = new MockCoapTransport();
    const proof = makeProof();
    const gateway = {
      get: jest.fn(async () => ({ ok: true, data: { payload: Uint8Array.of(0xa1, 0x61), contentFormat: 60 } })),
    };
    const bridge = createCoapSensorBridge({
      runtime: makeRuntime(proof), transport, gateway: gateway as never,
      bindings: [{ sensorId: 'temp1', path: ['sensors', 'temp'], host: '10.0.0.1', port: 5683, intervalMs: 1000 }],
    });
    await bridge.poll();
    expect(proof.createProof).not.toHaveBeenCalled();
  });

  it('registers observations and emits proofs for notifications', async () => {
    const transport = new MockCoapTransport();
    const proof = makeProof();
    const cancel = jest.fn(async () => {});
    let notify: ((entry: { payload: Uint8Array; contentFormat?: number; observe: number; receivedAt: number }) => void) | undefined;
    const gateway = {
      get: jest.fn(),
      observe: jest.fn(async (_path: string[], _host: string, _port: number, handler: typeof notify) => {
        notify = handler;
        return { ok: true, data: { token: 't', cancel } };
      }),
    };
    const payload = new Uint8Array(Buffer.from('a16474656d70fb4035800000000000', 'hex'));
    const bridge = createCoapSensorBridge({
      runtime: makeRuntime(proof), transport, gateway: gateway as never,
      bindings: [{ sensorId: 'temp1', path: ['sensors', 'temp'], host: '10.0.0.1', port: 5683, intervalMs: 1000, observe: true }],
    });
    await bridge.start();
    expect(gateway.get).not.toHaveBeenCalled();
    expect(notify).toBeDefined();

    notify!({ payload, contentFormat: 60, observe: 3, receivedAt: 1234 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const claim = proof.createProof.mock.calls[0][0].claims[0];
    expect(claim.observe).toBe(3);
    expect(claim.cbor).toEqual({ temp: 21.5 });
    expect(claim.timestamp).toBe(1234);

    await bridge.stop();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('falls back to polling when observation registration fails', async () => {
    const transport = new MockCoapTransport();
    const proof = makeProof();
    const gateway = {
      get: jest.fn(async () => ({ ok: false, error: 'no observation' })),
      observe: jest.fn(async () => ({ ok: false, error: 'not supported' })),
    };
    const bridge = createCoapSensorBridge({
      runtime: makeRuntime(proof), transport, gateway: gateway as never,
      bindings: [{ sensorId: 'temp1', path: ['sensors', 'temp'], host: '10.0.0.1', port: 5683, intervalMs: 1000, observe: true }],
    });
    await bridge.start();
    expect(gateway.observe).toHaveBeenCalledTimes(1);
    expect(gateway.get).toHaveBeenCalledTimes(1);
    await bridge.stop();
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

describe('native CoAP transport', () => {
  it('decodes pushed messages, surfaces sidecar errors and closes without a spurious error', async () => {
    const requests: Array<{ id: string; type: string }> = [];
    let peer: Socket | undefined;
    let resolvePeer: (socket: Socket) => void = () => {};
    const peerReady = new Promise<Socket>((resolve) => { resolvePeer = resolve; });
    const server = createServer((socket) => {
      peer = socket;
      resolvePeer(socket);
      let buffer = '';
      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        let newline: number;
        while ((newline = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          const request = JSON.parse(line) as { id: string };
          requests.push(request as { id: string; type: string });
          socket.write(JSON.stringify({ id: request.id, ok: true }) + '\n');
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;

    const transport = new NativeCoapTransport({ port, connectTimeoutMs: 1000, requestTimeoutMs: 1000 });
    const errors: Error[] = [];
    transport.onError((error) => errors.push(error));
    await transport.bind(5683);
    peer = await peerReady;

    const received = new Promise<{ message: Uint8Array; remote: { host: string; port: number } }>((resolve) => {
      transport.onMessage((message, remote) => resolve({ message, remote }));
    });
    peer!.write(JSON.stringify({ type: 'message', host: '10.0.0.1', port: 5683, data: '4501' }) + '\n');
    const push = await received;
    expect([...push.message]).toEqual([0x45, 0x01]);
    expect(push.remote).toEqual({ host: '10.0.0.1', port: 5683 });

    peer!.write(JSON.stringify({ type: 'error', code: 'read', error: 'boom' }) + '\n');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(errors.map((error) => error.message)).toContain('NativeCoapTransport: read: boom');

    await transport.send('10.0.0.1', 5683, new Uint8Array([0x40, 0x01, 0x00, 0x01]));
    expect(requests).toHaveLength(1);

    await transport.close();
    const errorsAtClose = errors.length;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(errors.length).toBe(errorsAtClose);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
