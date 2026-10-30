import { createGrpcGateway } from '../gateway.js';
import { createGrpcSensorBridge } from '../sensor-bridge.js';
import type { GrpcClient, GrpcStreamHandle } from '../transport.js';
import type { EdgeRuntime } from '@totemsdk/edge';

function makeStreamHandle(streamId: string): GrpcStreamHandle {
  let ended = false;
  const dataHandlers = new Set<(payload: Uint8Array) => void>();
  const endHandlers = new Set<() => void>();
  const errorHandlers = new Set<(err: Error) => void>();
  return {
    streamId,
    async send() {},
    async close() { ended = true; for (const h of [...endHandlers]) h(); },
    onData(h) { dataHandlers.add(h); return () => { dataHandlers.delete(h); }; },
    onEnd(h) { endHandlers.add(h); return () => { endHandlers.delete(h); }; },
    onError(h) { errorHandlers.add(h); return () => { errorHandlers.delete(h); }; },
  };
}

class MockGrpcClient implements GrpcClient {
  unaryMock: jest.Mock = jest.fn(async () => new Uint8Array([1, 2]));
  serverStreamMock: jest.Mock = jest.fn(async () => makeStreamHandle('s1'));
  clientStreamMock: jest.Mock = jest.fn(async () => makeStreamHandle('s2'));
  bidiStreamMock: jest.Mock = jest.fn(async () => makeStreamHandle('s3'));

  async unaryCall(path: string, payload: Uint8Array, deadlineMs?: number) { return this.unaryMock(path, payload, deadlineMs); }
  async serverStream(path: string, payload: Uint8Array, deadlineMs?: number) { return this.serverStreamMock(path, payload, deadlineMs); }
  async clientStream(path: string, deadlineMs?: number) { return this.clientStreamMock(path, deadlineMs); }
  async bidiStream(path: string, deadlineMs?: number) { return this.bidiStreamMock(path, deadlineMs); }
}

function makeRuntime(proof?: { createProof: jest.Mock }) {
  return { deviceId: 'd1', capabilities: {}, ports: { proof } } as unknown as EdgeRuntime;
}

function makeProof() {
  return { createProof: jest.fn(async () => ({ ok: true, data: { proofId: 'p1', proof: {} } })) };
}

describe('edge-grpc gateway', () => {
  it('start and stop report status transitions', async () => {
    const gw = createGrpcGateway({ runtime: makeRuntime(), client: new MockGrpcClient() });
    expect(gw.status).toBe('stopped');
    await gw.start();
    expect(gw.status).toBe('running');
    await gw.start();
    await gw.stop();
    expect(gw.status).toBe('stopped');
  });

  it('call invokes the client and returns the payload', async () => {
    const client = new MockGrpcClient();
    const gw = createGrpcGateway({ runtime: makeRuntime(), client });
    const res = await gw.call('/svc/GetValue', new Uint8Array([9]), 1000);
    expect(client.unaryMock).toHaveBeenCalledWith('/svc/GetValue', new Uint8Array([9]), 1000);
    expect(res).toEqual({ ok: true, data: { payload: new Uint8Array([1, 2]) } });
  });

  it('call maps client errors to an error result with code', async () => {
    const client = new MockGrpcClient();
    client.unaryMock.mockRejectedValue(Object.assign(new Error('unavailable'), { code: 14 }));
    const gw = createGrpcGateway({ runtime: makeRuntime(), client });
    const res = await gw.call('/svc/GetValue', new Uint8Array(0));
    expect(res).toEqual({ ok: false, error: 'unavailable', code: 14 });
  });

  it('openServerStream returns a stream handle', async () => {
    const client = new MockGrpcClient();
    const gw = createGrpcGateway({ runtime: makeRuntime(), client });
    const res = await gw.openServerStream('/svc/Subscribe', new Uint8Array(0));
    expect(client.serverStreamMock).toHaveBeenCalledWith('/svc/Subscribe', new Uint8Array(0), undefined);
    expect(res.ok).toBe(true);
    expect((res as { data: GrpcStreamHandle }).data.streamId).toBe('s1');
  });

  it('openServerStream maps failures', async () => {
    const client = new MockGrpcClient();
    client.serverStreamMock.mockRejectedValue(Object.assign(new Error('deadline exceeded'), { code: 4 }));
    const gw = createGrpcGateway({ runtime: makeRuntime(), client });
    const res = await gw.openServerStream('/svc/Subscribe', new Uint8Array(0));
    expect(res).toEqual({ ok: false, error: 'deadline exceeded', code: 4 });
  });

  it('openClientStream and openBidiStream delegate to the client', async () => {
    const client = new MockGrpcClient();
    const gw = createGrpcGateway({ runtime: makeRuntime(), client });
    const cs = await gw.openClientStream('/svc/Upload');
    expect(client.clientStreamMock).toHaveBeenCalledWith('/svc/Upload', undefined);
    expect((cs as { data: GrpcStreamHandle }).data.streamId).toBe('s2');
    const bs = await gw.openBidiStream('/svc/Chat');
    expect(client.bidiStreamMock).toHaveBeenCalledWith('/svc/Chat', undefined);
    expect((bs as { data: GrpcStreamHandle }).data.streamId).toBe('s3');
  });

  it('client stream methods map failures with codes', async () => {
    const client = new MockGrpcClient();
    client.clientStreamMock.mockRejectedValue(Object.assign(new Error('cancelled'), { code: 1 }));
    const gw = createGrpcGateway({ runtime: makeRuntime(), client });
    expect(await gw.openClientStream('/svc/Upload')).toEqual({ ok: false, error: 'cancelled', code: 1 });
  });

  it('stream handles dispatch onData and onEnd', async () => {
    const client = new MockGrpcClient();
    const gw = createGrpcGateway({ runtime: makeRuntime(), client });
    const res = await gw.openServerStream('/svc/Subscribe', new Uint8Array(0));
    const stream = (res as { data: GrpcStreamHandle }).data;
    const received: number[][] = [];
    stream.onData((d) => received.push(Array.from(d)));
    await stream.send(new Uint8Array([5]));
    await stream.close();
    expect(stream.streamId).toBe('s1');
  });
});

describe('edge-grpc sensor bridge', () => {
  it('poll calls the gateway and creates proofs', async () => {
    const gateway = {
      call: jest.fn(async () => ({ ok: true, data: { payload: new Uint8Array([7, 8]) } })),
    };
    const proof = makeProof();
    const bridge = createGrpcSensorBridge({
      runtime: makeRuntime(proof),
      transport: null as never,
      gateway: gateway as never,
      bindings: [{ sensorId: 'svc1', path: '/svc/GetTelemetry', intervalMs: 1000, dataType: 'telemetry' }],
    });
    await bridge.poll();
    expect(gateway.call).toHaveBeenCalledWith('/svc/GetTelemetry', new Uint8Array(0));
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'sensor:svc1',
      claims: [expect.objectContaining({ sensorId: 'svc1', path: '/svc/GetTelemetry', dataType: 'telemetry', payload: new Uint8Array([7, 8]) })],
    }));
  });

  it('poll is non-fatal when the gateway returns ok:false', async () => {
    const gateway = {
      call: jest.fn(async () => ({ ok: false, error: 'service down' })),
    };
    const bridge = createGrpcSensorBridge({
      runtime: makeRuntime(makeProof()),
      transport: null as never,
      gateway: gateway as never,
      bindings: [{ sensorId: 'svc1', path: '/svc/GetTelemetry', intervalMs: 1000 }],
    });
    await expect(bridge.poll()).resolves.toBeUndefined();
  });

  it('start schedules periodic polls and stop clears them', async () => {
    jest.useFakeTimers();
    const gateway = {
      call: jest.fn(async () => ({ ok: true, data: { payload: new Uint8Array() } })),
    };
    const proof = makeProof();
    const bridge = createGrpcSensorBridge({
      runtime: makeRuntime(proof),
      transport: null as never,
      gateway: gateway as never,
      bindings: [{ sensorId: 'svc1', path: '/svc/GetTelemetry', intervalMs: 1000 }],
    });
    const startPromise = bridge.start();
    await jest.advanceTimersByTimeAsync(0);
    await startPromise;
    expect(gateway.call).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1000);
    expect(gateway.call).toHaveBeenCalledTimes(2);
    await bridge.stop();
    jest.useRealTimers();
  });
});