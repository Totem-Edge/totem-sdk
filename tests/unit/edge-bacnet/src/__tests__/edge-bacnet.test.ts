import { createBacnetGateway } from '../gateway.js';
import { createBacnetSensorBridge } from '../sensor-bridge.js';
import type { BacnetTransportPort, BacnetDevice, BacnetPropertyValue, BacnetSubscription, BacnetCovNotification } from '../transport.js';
import type { EdgeRuntime } from '@totemsdk/edge';

class MockBacnetTransport implements BacnetTransportPort {
  initArgs: Array<{ deviceId: number; deviceName: string }> = [];
  closed = false;
  failInit = false;
  failDiscover = false;
  failRead = false;
  failWrite = false;
  devices: BacnetDevice[] = [];
  propertyValue: BacnetPropertyValue = {
    objectType: 'analog-input',
    objectInstance: 1,
    propertyId: 85,
    propertyName: 'present-value',
    value: 21.5,
    dataType: 'REAL',
  };
  discoverHandlers: Array<(device: BacnetDevice) => void> = [];
  errorHandlers: Array<(err: Error) => void> = [];
  readonly subscriptions: MockSubscription[] = [];

  init(deviceId: number, deviceName: string) {
    this.initArgs.push({ deviceId, deviceName });
    if (this.failInit) return Promise.reject(new Error('init failed'));
    return Promise.resolve();
  }
  close() { this.closed = true; return Promise.resolve(); }
  discoverDevices() {
    if (this.failDiscover) return Promise.reject(new Error('discover failed'));
    return Promise.resolve(this.devices);
  }
  readProperty(_deviceId: number, _objectType: string, _objectInstance: number, _propertyId: number) {
    if (this.failRead) return Promise.reject(new Error('read failed'));
    return Promise.resolve(this.propertyValue);
  }
  writeProperty() {
    if (this.failWrite) return Promise.reject(new Error('write failed'));
    return Promise.resolve();
  }
  subscribeCov(deviceId: number, objectType: string, objectInstance: number, lifetime?: number) {
    const sub = new MockSubscription({ deviceId, objectType, objectInstance, lifetime });
    this.subscriptions.push(sub);
    return Promise.resolve(sub);
  }
  onDeviceDiscovered(handler: (device: BacnetDevice) => void) {
    this.discoverHandlers.push(handler);
    return () => { this.discoverHandlers = this.discoverHandlers.filter((h) => h !== handler); };
  }
  onError(handler: (err: Error) => void) {
    this.errorHandlers.push(handler);
    return () => { this.errorHandlers = this.errorHandlers.filter((h) => h !== handler); };
  }
  emitDiscovered(device: BacnetDevice) { this.discoverHandlers.forEach((h) => h(device)); }
  emitError(err: Error) { this.errorHandlers.forEach((h) => h(err)); }
}

class MockSubscription implements BacnetSubscription {
  cancelled = false;
  readonly changeHandlers: Array<(event: BacnetCovNotification) => void> = [];
  constructor(readonly meta: { deviceId: number; objectType: string; objectInstance: number; lifetime?: number }) {}
  onChange(handler: (event: BacnetCovNotification) => void) {
    this.changeHandlers.push(handler);
    return () => { const i = this.changeHandlers.indexOf(handler); if (i >= 0) this.changeHandlers.splice(i, 1); };
  }
  cancel() { this.cancelled = true; return Promise.resolve(); }
  emitChange(event: BacnetCovNotification) { this.changeHandlers.forEach((h) => h(event)); }
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

const DEVICE: BacnetDevice = { deviceId: 101, address: '192.168.1.10', deviceName: 'AHU-1', vendorId: 1 };

describe('edge-bacnet gateway', () => {
  it('start inits transport and reports running status', async () => {
    const transport = new MockBacnetTransport();
    const gw = createBacnetGateway({ runtime: makeRuntime(), transport, deviceId: 5, deviceName: 'GW' });
    expect(gw.status).toBe('stopped');
    await gw.start();
    expect(transport.initArgs).toEqual([{ deviceId: 5, deviceName: 'GW' }]);
    expect(gw.status).toBe('running');
  });

  it('start is a no-op when already running', async () => {
    const transport = new MockBacnetTransport();
    const gw = createBacnetGateway({ runtime: makeRuntime(), transport, deviceId: 5, deviceName: 'GW' });
    await gw.start();
    await gw.start();
    expect(transport.initArgs).toHaveLength(1);
  });

  it('start propagates init errors', async () => {
    const transport = new MockBacnetTransport();
    transport.failInit = true;
    const gw = createBacnetGateway({ runtime: makeRuntime(), transport, deviceId: 5, deviceName: 'GW' });
    await expect(gw.start()).rejects.toThrow('init failed');
  });

  it('stop cancels COV subs, closes transport, and flips status to stopped', async () => {
    const transport = new MockBacnetTransport();
    const gw = createBacnetGateway({
      runtime: makeRuntime(),
      transport,
      deviceId: 5,
      deviceName: 'GW',
      covSubscriptions: [
        { deviceId: 101, objectType: 'analog-input', objectInstance: 1, sensorId: 's1' },
      ],
    });
    await gw.start();
    expect(transport.subscriptions).toHaveLength(1);
    await gw.stop();
    expect(transport.subscriptions[0].cancelled).toBe(true);
    expect(transport.closed).toBe(true);
    expect(gw.status).toBe('stopped');
  });

  it('emits a discovery proof for each device found', async () => {
    const transport = new MockBacnetTransport();
    const proof = makeProof();
    const gw = createBacnetGateway({ runtime: makeRuntime(proof), transport, deviceId: 5, deviceName: 'GW' });
    await gw.start();
    transport.emitDiscovered(DEVICE);
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'bacnet:discovery',
      claims: [expect.objectContaining({ deviceId: 101, deviceName: 'AHU-1', address: '192.168.1.10' })],
    }));
    await gw.stop();
  });

  it('emits a sensor proof on COV change for a bound sensor', async () => {
    const transport = new MockBacnetTransport();
    const proof = makeProof();
    const gw = createBacnetGateway({
      runtime: makeRuntime(proof),
      transport,
      deviceId: 5,
      deviceName: 'GW',
      covSubscriptions: [
        { deviceId: 101, objectType: 'analog-input', objectInstance: 1, sensorId: 'temp1' },
      ],
    });
    await gw.start();
    const sub = transport.subscriptions[0];
    sub.emitChange({ deviceId: 101, objectType: 'analog-input', objectInstance: 1, propertyId: 85, newValue: 22.4, receivedAt: Date.now() });
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'sensor:temp1',
      claims: [expect.objectContaining({ sensorId: 'temp1', newValue: 22.4 })],
    }));
    await gw.stop();
  });

  it('transport errors flip status to error', async () => {
    const transport = new MockBacnetTransport();
    const gw = createBacnetGateway({ runtime: makeRuntime(), transport, deviceId: 5, deviceName: 'GW' });
    await gw.start();
    transport.emitError(new Error('nack'));
    expect(gw.status).toBe('error');
    await gw.stop();
  });

  it('discoverDevices returns devices on success', async () => {
    const transport = new MockBacnetTransport();
    transport.devices = [DEVICE];
    const gw = createBacnetGateway({ runtime: makeRuntime(), transport, deviceId: 5, deviceName: 'GW' });
    const res = await gw.discoverDevices();
    expect(res).toEqual({ ok: true, data: { devices: [DEVICE] } });
  });

  it('discoverDevices returns error result when transport fails', async () => {
    const transport = new MockBacnetTransport();
    transport.failDiscover = true;
    const gw = createBacnetGateway({ runtime: makeRuntime(), transport, deviceId: 5, deviceName: 'GW' });
    const res = await gw.discoverDevices();
    expect(res).toEqual({ ok: false, error: 'Error: discover failed' });
  });

  it('readProperty returns value on success', async () => {
    const transport = new MockBacnetTransport();
    const gw = createBacnetGateway({ runtime: makeRuntime(), transport, deviceId: 5, deviceName: 'GW' });
    const res = await gw.readProperty(101, 'analog-input', 1, 85);
    expect(res.ok).toBe(true);
    expect((res as { data: { value: BacnetPropertyValue } }).data.value.value).toBe(21.5);
  });

  it('readProperty returns error result when transport fails', async () => {
    const transport = new MockBacnetTransport();
    transport.failRead = true;
    const gw = createBacnetGateway({ runtime: makeRuntime(), transport, deviceId: 5, deviceName: 'GW' });
    const res = await gw.readProperty(101, 'analog-input', 1, 85);
    expect(res).toEqual({ ok: false, error: 'Error: read failed' });
  });

  it('writeProperty returns ok on success', async () => {
    const transport = new MockBacnetTransport();
    const gw = createBacnetGateway({ runtime: makeRuntime(), transport, deviceId: 5, deviceName: 'GW' });
    const res = await gw.writeProperty(101, 'analog-output', 1, 85, 100);
    expect(res).toEqual({ ok: true });
  });

  it('writeProperty returns error result when transport fails', async () => {
    const transport = new MockBacnetTransport();
    transport.failWrite = true;
    const gw = createBacnetGateway({ runtime: makeRuntime(), transport, deviceId: 5, deviceName: 'GW' });
    const res = await gw.writeProperty(101, 'analog-output', 1, 85, 100, 8);
    expect(res).toEqual({ ok: false, error: 'Error: write failed' });
  });
});

describe('edge-bacnet sensor bridge', () => {
  it('poll reads property and creates a proof with sensor claims', async () => {
    const transport = new MockBacnetTransport();
    const proof = makeProof();
    const bridge = createBacnetSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [{ sensorId: 'temp1', deviceId: 101, objectType: 'analog-input', objectInstance: 1, propertyId: 85, intervalMs: 30_000, unit: 'degC' }],
    });
    await bridge.poll();
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'sensor:temp1',
      claims: [expect.objectContaining({ sensorId: 'temp1', value: 21.5, dataType: 'REAL', unit: 'degC' })],
    }));
  });

  it('poll uses binding dataType when provided', async () => {
    const transport = new MockBacnetTransport();
    const proof = makeProof();
    const bridge = createBacnetSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [{ sensorId: 't', deviceId: 101, objectType: 'analog-input', objectInstance: 1, propertyId: 85, intervalMs: 30_000, dataType: 'REAL', unit: 'degC' }],
    });
    await bridge.poll();
    expect((proof.createProof.mock.calls[0]?.[0] as unknown as { claims: Record<string, unknown>[] }).claims[0]).toMatchObject({ dataType: 'REAL', unit: 'degC' });
  });

  it('poll swallows transport failures', async () => {
    const transport = new MockBacnetTransport();
    transport.failRead = true;
    const bridge = createBacnetSensorBridge({
      runtime: makeRuntime(),
      transport,
      bindings: [{ sensorId: 't', deviceId: 101, objectType: 'analog-input', objectInstance: 1, propertyId: 85, intervalMs: 30_000 }],
    });
    await expect(bridge.poll()).resolves.not.toThrow();
  });

  it('start runs an initial poll then stop clears timers', async () => {
    const transport = new MockBacnetTransport();
    const proof = makeProof();
    const bridge = createBacnetSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [{ sensorId: 't', deviceId: 101, objectType: 'analog-input', objectInstance: 1, propertyId: 85, intervalMs: 10_000 }],
    });
    await bridge.start();
    expect(proof.createProof).toHaveBeenCalled();
    await bridge.stop();
  });

  it('start is idempotent', async () => {
    const transport = new MockBacnetTransport();
    const bridge = createBacnetSensorBridge({
      runtime: makeRuntime(),
      transport,
      bindings: [{ sensorId: 't', deviceId: 101, objectType: 'analog-input', objectInstance: 1, propertyId: 85, intervalMs: 10_000 }],
    });
    await bridge.start();
    await bridge.start();
    await bridge.stop();
  });
});