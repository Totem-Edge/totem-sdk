import { createGrpcGateway } from '../gateway.js';
import { createGrpcSensorBridge } from '../sensor-bridge.js';
import { NativeGrpcTransport } from '../native-transport.js';
import { createServer } from 'node:net';
import type { AddressInfo, Socket } from 'node:net';
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
  connectMock: jest.Mock = jest.fn(async () => {});
  closeMock: jest.Mock = jest.fn(async () => {});
  unaryMock: jest.Mock = jest.fn(async () => new Uint8Array([1, 2]));
  serverStreamMock: jest.Mock = jest.fn(async () => makeStreamHandle('s1'));
  clientStreamMock: jest.Mock = jest.fn(async () => makeStreamHandle('s2'));
  bidiStreamMock: jest.Mock = jest.fn(async () => makeStreamHandle('s3'));

  async connect(address: string) { return this.connectMock(address); }
  async close() { return this.closeMock(); }
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

  it('start connects to the configured address and stop closes the client', async () => {
    const client = new MockGrpcClient();
    const gw = createGrpcGateway({ runtime: makeRuntime(), client, address: '127.0.0.1:50051' });
    await gw.start();
    expect(client.connectMock).toHaveBeenCalledWith('127.0.0.1:50051');
    await gw.stop();
    expect(client.closeMock).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid method paths without calling the client', async () => {
    const client = new MockGrpcClient();
    const gw = createGrpcGateway({ runtime: makeRuntime(), client });
    for (const path of ['', 'pkg.Service/Method', '/a/b/c', '/only']) {
      const result = await gw.call(path, new Uint8Array(0));
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/Invalid gRPC method path/);
    }
    expect(client.unaryMock).not.toHaveBeenCalled();
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

describe('native gRPC transport', () => {
  it('maps sidecar responses, delivers client-stream results and surfaces stream errors', async () => {
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
          const request = JSON.parse(line) as { id: string; type: string };
          if (request.type === 'connect') socket.write(JSON.stringify({ id: request.id, ok: true }) + '\n');
          if (request.type === 'disconnect') socket.write(JSON.stringify({ id: request.id, ok: true }) + '\n');
          if (request.type === 'unary') socket.write(JSON.stringify({ id: request.id, ok: true, data: Buffer.from([1, 2]).toString('base64') }) + '\n');
          if (request.type === 'client_stream') socket.write(JSON.stringify({ id: request.id, ok: true, stream_id: 's1' }) + '\n');
          if (request.type === 'stream_send') socket.write(JSON.stringify({ id: request.id, ok: true }) + '\n');
          if (request.type === 'stream_close') {
            socket.write(JSON.stringify({ id: request.id, ok: true }) + '\n');
            socket.write(JSON.stringify({ type: 'stream_end', stream_id: 's1', payload: Buffer.from([9]).toString('base64') }) + '\n');
          }
          if (request.type === 'server_stream') {
            socket.write(JSON.stringify({ id: request.id, ok: true, stream_id: 's2' }) + '\n');
            socket.write(JSON.stringify({ type: 'stream_data', stream_id: 's2', payload: Buffer.from([7]).toString('base64') }) + '\n');
            socket.write(JSON.stringify({ type: 'stream_error', stream_id: 's2', error: 'internal', code: 13 }) + '\n');
          }
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;

    const transport = new NativeGrpcTransport({ port, connectTimeoutMs: 1000, requestTimeoutMs: 1000 });
    await transport.connect('127.0.0.1:50051');
    peer = await peerReady;
    expect(transport.state).toBe('open');

    expect([...await transport.unaryCall('/pkg.S/M', Uint8Array.of(1))]).toEqual([1, 2]);

    const clientStream = await transport.clientStream('/pkg.S/Upload');
    const streamData: number[][] = [];
    const streamEnded = new Promise<void>((resolve) => clientStream.onEnd(resolve));
    clientStream.onData((payload) => streamData.push([...payload]));
    await clientStream.send(Uint8Array.of(1));
    await clientStream.close();
    await streamEnded;
    expect(streamData).toEqual([[9]]);

    const serverStream = await transport.serverStream('/pkg.S/Subscribe', new Uint8Array(0));
    const serverData: number[][] = [];
    const streamError = new Promise<Error>((resolve) => serverStream.onError(resolve));
    serverStream.onData((payload) => serverData.push([...payload]));
    const error = await streamError;
    expect((error as Error & { code?: number }).code).toBe(13);
    expect(serverData).toEqual([[7]]);

    await transport.close();
    expect(transport.state).toBe('closed');
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
