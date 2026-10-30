import { createBleGateway } from '../gateway.js';
import { createBleSensorBridge } from '../sensor-bridge.js';
import type { BleTransportPort, BlePeripheral, BleNotification } from '../transport.js';
import type { EdgeRuntime } from '@totemsdk/edge';

class MockBleTransport implements BleTransportPort {
  scanArgs: Array<string[] | undefined> = [];
  stopScanCalled = false;
  failScan = false;
  failConnect = false;
  failDisconnect = false;
  failRead = false;
  failWrite = false;
  failSubscribe = false;
  readonly connects: string[] = [];
  readonly disconnects: string[] = [];
  readonly subscribes: string[] = [];
  readonly unsubscribes: string[] = [];
  readonly reads: Array<{ peripheralId: string; serviceUuid: string; characteristicUuid: string }> = [];
  discoverHandlers: Array<(p: BlePeripheral) => void> = [];
  notificationHandlers: Array<(e: BleNotification) => void> = [];
  disconnectHandlers: Array<(id: string) => void> = [];
  errorHandlers: Array<(err: Error) => void> = [];

  startScanning(services?: string[]) { this.scanArgs.push(services); if (this.failScan) return Promise.reject(new Error('scan failed')); return Promise.resolve(); }
  stopScanning() { this.stopScanCalled = true; return Promise.resolve(); }
  connect(peripheralId: string) { this.connects.push(peripheralId); if (this.failConnect) return Promise.reject(new Error('connect failed')); return Promise.resolve(); }
  disconnect(peripheralId: string) { this.disconnects.push(peripheralId); if (this.failDisconnect) return Promise.reject(new Error('disconnect failed')); return Promise.resolve(); }
  discover() { return Promise.resolve([]); }
  read(peripheralId: string, serviceUuid: string, characteristicUuid: string) {
    this.reads.push({ peripheralId, serviceUuid, characteristicUuid });
    if (this.failRead) return Promise.reject(new Error('read failed'));
    return Promise.resolve(new Uint8Array([1, 2, 3]));
  }
  write() { if (this.failWrite) return Promise.reject(new Error('write failed')); return Promise.resolve(); }
  subscribe(peripheralId: string, serviceUuid: string, characteristicUuid: string) {
    this.subscribes.push(peripheralId);
    if (this.failSubscribe) return Promise.reject(new Error('subscribe failed'));
    return Promise.resolve();
  }
  unsubscribe(peripheralId: string, serviceUuid: string, characteristicUuid: string) {
    this.unsubscribes.push(peripheralId);
    return Promise.resolve();
  }
  onDiscover(handler: (p: BlePeripheral) => void) { this.discoverHandlers.push(handler); return () => { this.discoverHandlers = this.discoverHandlers.filter((h) => h !== handler); }; }
  onNotification(handler: (e: BleNotification) => void) { this.notificationHandlers.push(handler); return () => { this.notificationHandlers = this.notificationHandlers.filter((h) => h !== handler); }; }
  onDisconnect(handler: (id: string) => void) { this.disconnectHandlers.push(handler); return () => { this.disconnectHandlers = this.disconnectHandlers.filter((h) => h !== handler); }; }
  onError(handler: (err: Error) => void) { this.errorHandlers.push(handler); return () => { this.errorHandlers = this.errorHandlers.filter((h) => h !== handler); }; }
  emitDiscover(p: BlePeripheral) { this.discoverHandlers.forEach((h) => h(p)); }
  emitNotification(e: BleNotification) { this.notificationHandlers.forEach((h) => h(e)); }
  emitDisconnect(id: string) { this.disconnectHandlers.forEach((h) => h(id)); }
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

const PERIPHERAL: BlePeripheral = { id: 'p1', address: 'AA:BB:CC:DD:EE:FF', name: 'Temp Beacon', rssi: -55, services: ['1809'] };

describe('edge-ble gateway', () => {
  it('start scans with configured services and reports running status', async () => {
    const transport = new MockBleTransport();
    const gw = createBleGateway({ runtime: makeRuntime(), transport, scanServices: ['1809'] });
    expect(gw.status).toBe('stopped');
    await gw.start();
    expect(transport.scanArgs).toEqual([['1809']]);
    expect(gw.status).toBe('running');
  });

  it('start defaults to a full scan when no services given', async () => {
    const transport = new MockBleTransport();
    const gw = createBleGateway({ runtime: makeRuntime(), transport });
    await gw.start();
    expect(transport.scanArgs[0]).toBeUndefined();
  });

  it('start propagates scan errors', async () => {
    const transport = new MockBleTransport();
    transport.failScan = true;
    const gw = createBleGateway({ runtime: makeRuntime(), transport });
    await expect(gw.start()).rejects.toThrow('scan failed');
  });

  it('start is a no-op when already running', async () => {
    const transport = new MockBleTransport();
    const gw = createBleGateway({ runtime: makeRuntime(), transport });
    await gw.start();
    await gw.start();
    expect(transport.scanArgs).toHaveLength(1);
  });

  it('stop stops scanning and reports stopped status', async () => {
    const transport = new MockBleTransport();
    const gw = createBleGateway({ runtime: makeRuntime(), transport });
    await gw.start();
    await gw.stop();
    expect(transport.stopScanCalled).toBe(true);
    expect(gw.status).toBe('stopped');
  });

  it('dedupes discovered peripherals and lists them', async () => {
    const transport = new MockBleTransport();
    const gw = createBleGateway({ runtime: makeRuntime(), transport });
    await gw.start();
    transport.emitDiscover(PERIPHERAL);
    transport.emitDiscover(PERIPHERAL);
    expect(gw.peripherals).toEqual([PERIPHERAL]);
    await gw.stop();
  });

  it('removes peripherals on disconnect', async () => {
    const transport = new MockBleTransport();
    const gw = createBleGateway({ runtime: makeRuntime(), transport });
    await gw.start();
    transport.emitDiscover(PERIPHERAL);
    transport.emitDisconnect('p1');
    expect(gw.peripherals).toEqual([]);
    await gw.stop();
  });

  it('emits a proof on characteristic notification', async () => {
    const transport = new MockBleTransport();
    const proof = makeProof();
    const gw = createBleGateway({ runtime: makeRuntime(proof), transport });
    await gw.start();
    transport.emitNotification({ peripheralId: 'p1', serviceUuid: '1809', characteristicUuid: '2a1c', value: new Uint8Array([21, 5]), receivedAt: Date.now() });
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'ble:p1',
      claims: [expect.objectContaining({ peripheralId: 'p1', characteristicUuid: '2a1c', value: [21, 5] })],
    }));
    await gw.stop();
  });

  it('transport errors flip status to error', async () => {
    const transport = new MockBleTransport();
    const gw = createBleGateway({ runtime: makeRuntime(), transport });
    await gw.start();
    transport.emitError(new Error('adapter reset'));
    expect(gw.status).toBe('error');
    await gw.stop();
  });

  it('connect and disconnect delegate to transport', async () => {
    const transport = new MockBleTransport();
    const gw = createBleGateway({ runtime: makeRuntime(), transport });
    await gw.connect('p1');
    await gw.disconnect('p1');
    expect(transport.connects).toEqual(['p1']);
    expect(transport.disconnects).toEqual(['p1']);
  });

  it('read returns bytes on success and maps failures', async () => {
    const transport = new MockBleTransport();
    const gw = createBleGateway({ runtime: makeRuntime(), transport });
    const res = await gw.read('p1', '1809', '2a1c');
    expect(res.ok).toBe(true);
    expect(Array.from((res as { data: { value: Uint8Array } }).data.value)).toEqual([1, 2, 3]);

    const failing = new MockBleTransport();
    failing.failRead = true;
    const gwFail = createBleGateway({ runtime: makeRuntime(), transport: failing });
    expect(await gwFail.read('p1', '1809', '2a1c')).toEqual({ ok: false, error: 'Error: read failed' });
  });

  it('write returns ok on success and maps failures', async () => {
    const transport = new MockBleTransport();
    const gw = createBleGateway({ runtime: makeRuntime(), transport });
    expect(await gw.write('p1', '1809', '2a1c', new Uint8Array([9]))).toEqual({ ok: true });

    const failing = new MockBleTransport();
    failing.failWrite = true;
    const gwFail = createBleGateway({ runtime: makeRuntime(), transport: failing });
    expect(await gwFail.write('p1', '1809', '2a1c', new Uint8Array([9]))).toEqual({ ok: false, error: 'Error: write failed' });
  });

  it('subscribe returns ok on success and maps failures', async () => {
    const transport = new MockBleTransport();
    const gw = createBleGateway({ runtime: makeRuntime(), transport });
    expect(await gw.subscribe('p1', '1809', '2a1c')).toEqual({ ok: true });

    const failing = new MockBleTransport();
    failing.failSubscribe = true;
    const gwFail = createBleGateway({ runtime: makeRuntime(), transport: failing });
    expect(await gwFail.subscribe('p1', '1809', '2a1c')).toEqual({ ok: false, error: 'Error: subscribe failed' });
  });
});

describe('edge-ble sensor bridge', () => {
  it('start connects and subscribes for each binding', async () => {
    const transport = new MockBleTransport();
    const proof = makeProof();
    const bridge = createBleSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [{ sensorId: 'temp1', peripheralId: 'p1', serviceUuid: '1809', characteristicUuid: '2a1c' }],
    });
    await bridge.start();
    expect(transport.connects).toEqual(['p1']);
    expect(transport.subscribes).toEqual(['p1']);
  });

  it('maps notifications to sensor proofs for the matching binding', async () => {
    const transport = new MockBleTransport();
    const proof = makeProof();
    const bridge = createBleSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [
        { sensorId: 'temp1', peripheralId: 'p1', serviceUuid: '1809', characteristicUuid: '2a1c', unit: 'degC' },
        { sensorId: 'other', peripheralId: 'p2', serviceUuid: '180f', characteristicUuid: '2a19' },
      ],
    });
    await bridge.start();
    transport.emitNotification({ peripheralId: 'p1', serviceUuid: '1809', characteristicUuid: '2a1c', value: new Uint8Array([21]), receivedAt: Date.now() });
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'sensor:temp1',
      claims: [expect.objectContaining({ sensorId: 'temp1', value: [21], unit: 'degC' })],
    }));
    expect(proof.createProof).toHaveBeenCalledTimes(1);
    await bridge.stop();
  });

  it('ignores notifications from unmatched characteristics', async () => {
    const transport = new MockBleTransport();
    const proof = makeProof();
    const bridge = createBleSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [{ sensorId: 'temp1', peripheralId: 'p1', serviceUuid: '1809', characteristicUuid: '2a1c' }],
    });
    await bridge.start();
    transport.emitNotification({ peripheralId: 'zzz', serviceUuid: '0000', characteristicUuid: '0001', value: new Uint8Array(), receivedAt: Date.now() });
    expect(proof.createProof).not.toHaveBeenCalled();
    await bridge.stop();
  });

  it('stop unsubscribes and disconnects for each binding', async () => {
    const transport = new MockBleTransport();
    const bridge = createBleSensorBridge({
      runtime: makeRuntime(),
      transport,
      bindings: [{ sensorId: 'temp1', peripheralId: 'p1', serviceUuid: '1809', characteristicUuid: '2a1c' }],
    });
    await bridge.start();
    await bridge.stop();
    expect(transport.unsubscribes).toEqual(['p1']);
    expect(transport.disconnects).toEqual(['p1']);
  });

  it('poll reads values and creates proofs', async () => {
    const transport = new MockBleTransport();
    const proof = makeProof();
    const bridge = createBleSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [{ sensorId: 'temp1', peripheralId: 'p1', serviceUuid: '1809', characteristicUuid: '2a1c' }],
    });
    await bridge.poll();
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'sensor:temp1',
      claims: [expect.objectContaining({ sensorId: 'temp1', value: [1, 2, 3] })],
    }));
  });

  it('poll propagates read failures', async () => {
    const transport = new MockBleTransport();
    transport.failRead = true;
    const bridge = createBleSensorBridge({
      runtime: makeRuntime(),
      transport,
      bindings: [{ sensorId: 'temp1', peripheralId: 'p1', serviceUuid: '1809', characteristicUuid: '2a1c' }],
    });
    await expect(bridge.poll()).rejects.toThrow('read failed');
  });
});