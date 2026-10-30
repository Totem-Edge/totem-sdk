import { createCanGateway } from '../gateway.js';
import { createCanSensorBridge } from '../sensor-bridge.js';
import type { CanTransportPort, CanFrame } from '../transport.js';
import type { EdgeRuntime } from '@totemsdk/edge';

class MockCanTransport implements CanTransportPort {
  opens: string[] = [];
  closeCalls = 0;
  sent: Array<{ id: number; data: Uint8Array; isExtended: boolean }> = [];
  failOpen = false;
  failSend = false;
  frameHandlers: Array<(frame: CanFrame) => void> = [];
  errorHandlers: Array<(err: Error) => void> = [];

  async open(interfaceName: string) { this.opens.push(interfaceName); if (this.failOpen) throw new Error('open failed'); }
  async close() { this.closeCalls++; }
  async send(id: number, data: Uint8Array, isExtended: boolean) { if (this.failSend) throw new Error('send failed'); this.sent.push({ id, data, isExtended }); }
  onFrame(handler: (frame: CanFrame) => void) { this.frameHandlers.push(handler); return () => { this.frameHandlers = this.frameHandlers.filter(h => h !== handler); }; }
  onError(handler: (err: Error) => void) { this.errorHandlers.push(handler); return () => { this.errorHandlers = this.errorHandlers.filter(h => h !== handler); }; }
  emitFrame(frame: CanFrame) { for (const h of this.frameHandlers) h(frame); }
  emitError(err: Error) { for (const h of this.errorHandlers) h(err); }
}

function makeRuntime(proof?: { createProof: jest.Mock }) {
  return { deviceId: 'd1', capabilities: {}, ports: { proof } } as unknown as EdgeRuntime;
}

function makeProof() {
  return { createProof: jest.fn(async () => ({ ok: true, data: { proofId: 'p1', proof: {} } })) };
}

const RPM_SIGNAL = {
  name: 'rpm',
  canId: 0x123,
  isExtended: false,
  startBit: 0,
  length: 16,
  isSigned: false,
  isBigEndian: false,
  scale: 0.5,
  offset: 0,
  unit: 'rpm',
};

describe('edge-can gateway', () => {
  it('start opens the interface and reports running status, stop closes', async () => {
    const transport = new MockCanTransport();
    const gw = createCanGateway({ runtime: makeRuntime(), transport, interfaceName: 'can0' });
    expect(gw.status).toBe('stopped');
    await gw.start();
    expect(transport.opens).toEqual(['can0']);
    expect(gw.status).toBe('running');
    await gw.stop();
    expect(transport.closeCalls).toBe(1);
    expect(gw.status).toBe('stopped');
  });

  it('start is a no-op when already running', async () => {
    const transport = new MockCanTransport();
    const gw = createCanGateway({ runtime: makeRuntime(), transport, interfaceName: 'can0' });
    await gw.start();
    await gw.start();
    expect(transport.opens).toHaveLength(1);
  });

  it('start propagates open failures', async () => {
    const transport = new MockCanTransport();
    transport.failOpen = true;
    const gw = createCanGateway({ runtime: makeRuntime(), transport, interfaceName: 'can0' });
    await expect(gw.start()).rejects.toThrow('open failed');
  });

  it('send delegates to the transport', async () => {
    const transport = new MockCanTransport();
    const gw = createCanGateway({ runtime: makeRuntime(), transport, interfaceName: 'can0' });
    await gw.send(0x100, new Uint8Array([1, 2, 3]), true);
    expect(transport.sent).toEqual([{ id: 0x100, data: new Uint8Array([1, 2, 3]), isExtended: true }]);
  });

  it('decodes little-endian signals and emits a proof for matching frames', async () => {
    const transport = new MockCanTransport();
    const proof = makeProof();
    const gw = createCanGateway({ runtime: makeRuntime(proof), transport, interfaceName: 'can0', signals: [RPM_SIGNAL] });
    await gw.start();
    transport.emitFrame({ id: 0x123, isExtended: false, isRtr: false, dlc: 2, data: new Uint8Array([0x05, 0x00]), receivedAt: 1000 });
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'can:can0',
      claims: [expect.objectContaining({ canId: 0x123, signals: [{ name: 'rpm', value: 2.5, unit: 'rpm', raw: new Uint8Array([0x05, 0x00]) }] })],
    }));
    await gw.stop();
  });

  it('decodes big-endian signals correctly', async () => {
    const transport = new MockCanTransport();
    const proof = makeProof();
    const gw = createCanGateway({
      runtime: makeRuntime(proof),
      transport,
      interfaceName: 'can0',
      signals: [{ ...RPM_SIGNAL, isBigEndian: true, scale: 1 }],
    });
    await gw.start();
    transport.emitFrame({ id: 0x123, isExtended: false, isRtr: false, dlc: 2, data: new Uint8Array([0x01, 0x02]), receivedAt: 1000 });
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      claims: [expect.objectContaining({ signals: [{ name: 'rpm', value: 516, unit: 'rpm', raw: new Uint8Array([0x01, 0x02]) }] })],
    }));
    await gw.stop();
  });

  it('sign-extends signed signals', async () => {
    const transport = new MockCanTransport();
    const proof = makeProof();
    const gw = createCanGateway({
      runtime: makeRuntime(proof),
      transport,
      interfaceName: 'can0',
      signals: [{ ...RPM_SIGNAL, isSigned: true, scale: 1 }],
    });
    await gw.start();
    transport.emitFrame({ id: 0x123, isExtended: false, isRtr: false, dlc: 2, data: new Uint8Array([0xFF, 0xFF]), receivedAt: 1000 });
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      claims: [expect.objectContaining({ signals: [{ name: 'rpm', value: -1, unit: 'rpm', raw: new Uint8Array([0xFF, 0xFF]) }] })],
    }));
    await gw.stop();
  });

  it('ignores frames that match no signal definition', async () => {
    const transport = new MockCanTransport();
    const proof = makeProof();
    const gw = createCanGateway({ runtime: makeRuntime(proof), transport, interfaceName: 'can0', signals: [RPM_SIGNAL] });
    await gw.start();
    transport.emitFrame({ id: 0xFFF, isExtended: false, isRtr: false, dlc: 0, data: new Uint8Array(), receivedAt: 1000 });
    expect(proof.createProof).not.toHaveBeenCalled();
    await gw.stop();
  });

  it('transport errors flip status to error', async () => {
    const transport = new MockCanTransport();
    const gw = createCanGateway({ runtime: makeRuntime(), transport, interfaceName: 'can0' });
    await gw.start();
    transport.emitError(new Error('adapter reset'));
    expect(gw.status).toBe('error');
    await gw.stop();
  });
});

describe('edge-can sensor bridge', () => {
  it('start subscribes and emits proofs for matching frames', async () => {
    const transport = new MockCanTransport();
    const proof = makeProof();
    const bridge = createCanSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [{ sensorId: 'sensor1', canId: 0x123, isExtended: false, signalName: 'rpm', dataType: 'engine' }],
    });
    await bridge.start();
    transport.emitFrame({ id: 0x123, isExtended: false, isRtr: false, dlc: 2, data: new Uint8Array([10, 0]), receivedAt: 500 });
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'sensor:sensor1',
      claims: [expect.objectContaining({ sensorId: 'sensor1', canId: 0x123, signalName: 'rpm', data: [10, 0], timestamp: 500 })],
    }));
    await bridge.stop();
  });

  it('ignores frames for other CAN IDs', async () => {
    const transport = new MockCanTransport();
    const proof = makeProof();
    const bridge = createCanSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [{ sensorId: 'sensor1', canId: 0x123, isExtended: false, signalName: 'rpm' }],
    });
    await bridge.start();
    transport.emitFrame({ id: 0x999, isExtended: false, isRtr: false, dlc: 1, data: new Uint8Array([1]), receivedAt: 500 });
    expect(proof.createProof).not.toHaveBeenCalled();
    await bridge.stop();
  });

  it('stop unsubscribes from frame events', async () => {
    const transport = new MockCanTransport();
    const proof = makeProof();
    const bridge = createCanSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [{ sensorId: 'sensor1', canId: 0x123, isExtended: false, signalName: 'rpm' }],
    });
    await bridge.start();
    await bridge.stop();
    transport.emitFrame({ id: 0x123, isExtended: false, isRtr: false, dlc: 1, data: new Uint8Array([1]), receivedAt: 500 });
    expect(proof.createProof).not.toHaveBeenCalled();
  });
});