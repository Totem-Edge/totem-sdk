import { createLorawanGateway } from '../gateway.js';
import { createLorawanSensorBridge } from '../sensor-bridge.js';
import type { LorawanTransportPort, LorawanMessage } from '../transport.js';
import type { EdgeRuntime } from '@totemsdk/edge';

class MockLorawanTransport implements LorawanTransportPort {
  otaaJoin: Array<{ devEui: string; appEui: string; appKey: string }> = [];
  abpActivate: Array<{ devAddr: string; nwkSKey: string; appSKey: string }> = [];
  readonly confirmed: Array<{ port: number; data: Uint8Array }> = [];
  readonly unconfirmed: Array<{ port: number; data: Uint8Array }> = [];
  failJoin = false;
  failSendConfirmed = false;
  failSendUnconfirmed = false;
  downlinkHandlers: Array<(m: LorawanMessage) => void> = [];
  joinHandlers: Array<(devAddr: string) => void> = [];
  errorHandlers: Array<(err: Error) => void> = [];

  joinOtaa(devEui: string, appEui: string, appKey: string) {
    this.otaaJoin.push({ devEui, appEui, appKey });
    if (this.failJoin) return Promise.reject(new Error('join failed'));
    return Promise.resolve();
  }
  activateAbp(devAddr: string, nwkSKey: string, appSKey: string) {
    this.abpActivate.push({ devAddr, nwkSKey, appSKey });
    if (this.failJoin) return Promise.reject(new Error('activate failed'));
    return Promise.resolve();
  }
  sendConfirmed(port: number, data: Uint8Array) {
    this.confirmed.push({ port, data });
    if (this.failSendConfirmed) return Promise.reject(new Error('send confirmed failed'));
    return Promise.resolve();
  }
  sendUnconfirmed(port: number, data: Uint8Array) {
    this.unconfirmed.push({ port, data });
    if (this.failSendUnconfirmed) return Promise.reject(new Error('send unconfirmed failed'));
    return Promise.resolve();
  }
  onDownlink(handler: (m: LorawanMessage) => void) { this.downlinkHandlers.push(handler); return () => { this.downlinkHandlers = this.downlinkHandlers.filter((h) => h !== handler); }; }
  onJoin(handler: (devAddr: string) => void) { this.joinHandlers.push(handler); return () => { this.joinHandlers = this.joinHandlers.filter((h) => h !== handler); }; }
  onError(handler: (err: Error) => void) { this.errorHandlers.push(handler); return () => { this.errorHandlers = this.errorHandlers.filter((h) => h !== handler); }; }
  emitDownlink(m: LorawanMessage) { this.downlinkHandlers.forEach((h) => h(m)); }
  emitJoin(devAddr: string) { this.joinHandlers.forEach((h) => h(devAddr)); }
  emitError(err: Error) { this.errorHandlers.forEach((h) => h(err)); }
}

function makeRuntime(proof?: { createProof: jest.Mock }) {
  return { deviceId: 'd1', capabilities: {}, ports: { proof } } as unknown as EdgeRuntime;
}

function makeProof() {
  const createProof = jest.fn(async (params: { subject: string; claims: unknown[] }) =>
    ({ ok: true, data: { proofId: 'p1', proof: {} } }),
  );
  return { createProof };
}

const MESSAGE: LorawanMessage = {
  port: 2, payload: new Uint8Array([0xfa, 0x01]), confirmed: true, frameCounter: 12, snr: 8.5, rssi: -95, receivedAt: Date.now(),
};

describe('edge-lorawan gateway', () => {
  it('start joins via OTAA when otaa credentials are given', async () => {
    const transport = new MockLorawanTransport();
    const gw = createLorawanGateway({
      runtime: makeRuntime(),
      transport,
      otaa: { devEui: '0004A30B001B7A73', appEui: '0000000000000000', appKey: '00000000000000000000000000000000' },
    });
    expect(gw.status).toBe('stopped');
    await gw.start();
    expect(transport.otaaJoin).toEqual([{ devEui: '0004A30B001B7A73', appEui: '0000000000000000', appKey: '00000000000000000000000000000000' }]);
    expect(transport.abpActivate).toHaveLength(0);
    expect(gw.status).toBe('running');
  });

  it('start activates via ABP when abp credentials are given', async () => {
    const transport = new MockLorawanTransport();
    const gw = createLorawanGateway({
      runtime: makeRuntime(),
      transport,
      abp: { devAddr: '26011F7D', nwkSKey: '00000000000000000000000000000000', appSKey: '00000000000000000000000000000000' },
    });
    await gw.start();
    expect(transport.abpActivate).toEqual([{ devAddr: '26011F7D', nwkSKey: '00000000000000000000000000000000', appSKey: '00000000000000000000000000000000' }]);
    expect(transport.otaaJoin).toHaveLength(0);
  });

  it('start throws when no credentials are given', async () => {
    const transport = new MockLorawanTransport();
    const gw = createLorawanGateway({ runtime: makeRuntime(), transport });
    await expect(gw.start()).rejects.toThrow('LoRaWAN gateway requires OTAA or ABP credentials');
  });

  it('start propagates join failures', async () => {
    const transport = new MockLorawanTransport();
    transport.failJoin = true;
    const gw = createLorawanGateway({
      runtime: makeRuntime(),
      transport,
      otaa: { devEui: 'x', appEui: 'y', appKey: 'z' },
    });
    await expect(gw.start()).rejects.toThrow('join failed');
  });

  it('start is a no-op when already running', async () => {
    const transport = new MockLorawanTransport();
    const gw = createLorawanGateway({
      runtime: makeRuntime(),
      transport,
      otaa: { devEui: 'x', appEui: 'y', appKey: 'z' },
    });
    await gw.start();
    await gw.start();
    expect(transport.otaaJoin).toHaveLength(1);
  });

  it('stop reports stopped status and unsubscribes handlers', async () => {
    const transport = new MockLorawanTransport();
    const proof = makeProof();
    const gw = createLorawanGateway({
      runtime: makeRuntime(proof),
      transport,
      otaa: { devEui: 'x', appEui: 'y', appKey: 'z' },
    });
    await gw.start();
    await gw.stop();
    expect(gw.status).toBe('stopped');
    transport.emitDownlink(MESSAGE);
    expect(proof.createProof).not.toHaveBeenCalled();
  });

  it('emits a proof on downlink messages', async () => {
    const transport = new MockLorawanTransport();
    const proof = makeProof();
    const gw = createLorawanGateway({
      runtime: makeRuntime(proof),
      transport,
      otaa: { devEui: 'x', appEui: 'y', appKey: 'z' },
    });
    await gw.start();
    transport.emitDownlink(MESSAGE);
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'lorawan:downlink',
      claims: [expect.objectContaining({ port: 2, payload: [0xfa, 0x01], confirmed: true, frameCounter: 12 })],
    }));
    await gw.stop();
  });

  it('emits a proof on join events', async () => {
    const transport = new MockLorawanTransport();
    const proof = makeProof();
    const gw = createLorawanGateway({
      runtime: makeRuntime(proof),
      transport,
      otaa: { devEui: 'x', appEui: 'y', appKey: 'z' },
    });
    await gw.start();
    transport.emitJoin('26011F7D');
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'lorawan:join',
      claims: [{ devAddr: '26011F7D', timestamp: expect.any(Number) }],
    }));
    await gw.stop();
  });

  it('transport errors flip status to error', async () => {
    const transport = new MockLorawanTransport();
    const gw = createLorawanGateway({
      runtime: makeRuntime(),
      transport,
      otaa: { devEui: 'x', appEui: 'y', appKey: 'z' },
    });
    await gw.start();
    transport.emitError(new Error('radio lost'));
    expect(gw.status).toBe('error');
    await gw.stop();
  });

  it('sendConfirmed and sendUnconfirmed delegate to transport', async () => {
    const transport = new MockLorawanTransport();
    const gw = createLorawanGateway({
      runtime: makeRuntime(),
      transport,
      otaa: { devEui: 'x', appEui: 'y', appKey: 'z' },
    });
    const data = new Uint8Array([1, 2]);
    await gw.sendConfirmed(2, data);
    await gw.sendUnconfirmed(3, data);
    expect(transport.confirmed).toEqual([{ port: 2, data }]);
    expect(transport.unconfirmed).toEqual([{ port: 3, data }]);
  });
});

describe('edge-lorawan sensor bridge', () => {
  it('start maps downlinks to proofs for the matching port', async () => {
    const transport = new MockLorawanTransport();
    const proof = makeProof();
    const bridge = createLorawanSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [
        { sensorId: 'level', port: 2, intervalMs: 60_000, unit: 'percent' },
        { sensorId: 'other', port: 9, intervalMs: 60_000 },
      ],
    });
    await bridge.start();
    transport.emitDownlink(MESSAGE);
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'sensor:level',
      claims: [expect.objectContaining({ sensorId: 'level', port: 2, payload: [0xfa, 0x01], unit: 'percent' })],
    }));
    expect(proof.createProof).toHaveBeenCalledTimes(1);
    await bridge.stop();
  });

  it('ignores downlinks for unmapped ports', async () => {
    const transport = new MockLorawanTransport();
    const proof = makeProof();
    const bridge = createLorawanSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [{ sensorId: 'level', port: 2, intervalMs: 60_000 }],
    });
    await bridge.start();
    transport.emitDownlink({ ...MESSAGE, port: 44 });
    expect(proof.createProof).not.toHaveBeenCalled();
    await bridge.stop();
  });

  it('stop unsubscribes the handler', async () => {
    const transport = new MockLorawanTransport();
    const proof = makeProof();
    const bridge = createLorawanSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [{ sensorId: 'level', port: 2, intervalMs: 60_000 }],
    });
    await bridge.start();
    expect(transport.downlinkHandlers).toHaveLength(1);
    await bridge.stop();
    transport.emitDownlink(MESSAGE);
    expect(proof.createProof).not.toHaveBeenCalled();
  });

  it('poll sends a confirmed uplink per binding with a zero byte', async () => {
    const transport = new MockLorawanTransport();
    const bridge = createLorawanSensorBridge({
      runtime: makeRuntime(),
      transport,
      bindings: [
        { sensorId: 'level', port: 2, intervalMs: 60_000 },
        { sensorId: 'temp', port: 3, intervalMs: 60_000 },
      ],
    });
    await bridge.poll();
    expect(transport.confirmed.map((c) => ({ port: c.port, data: Array.from(c.data) }))).toEqual([
      { port: 2, data: [0] },
      { port: 3, data: [0] },
    ]);
  });
});