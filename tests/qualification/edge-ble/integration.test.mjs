import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBleGateway } from '../../../packages/edge-ble/dist/gateway.js';
import { createBleSensorBridge } from '../../../packages/edge-ble/dist/sensor-bridge.js';

class SimulatedBle {
  scanning = [];
  connected = new Set();
  writes = [];
  subscriptions = [];
  discoverHandlers = [];
  notificationHandlers = [];
  disconnectHandlers = [];
  errorHandlers = [];

  async startScanning(services) { this.scanning.push(services); }
  async stopScanning() { this.stopped = true; }
  async connect(id) { this.connected.add(id); }
  async disconnect(id) { this.connected.delete(id); }
  async discover() { return []; }
  async read(id, service, characteristic) {
    if (characteristic === 'missing') throw new Error('characteristic not found');
    return Uint8Array.of(21, 5);
  }
  async write(id, service, characteristic, data) { this.writes.push({ id, service, characteristic, data: [...data] }); }
  async subscribe(id, service, characteristic) { this.subscriptions.push({ id, service, characteristic }); }
  async unsubscribe(id, service, characteristic) { this.subscriptions = this.subscriptions.filter((entry) => entry.characteristic !== characteristic); }
  onDiscover(handler) { this.discoverHandlers.push(handler); return () => {}; }
  onNotification(handler) { this.notificationHandlers.push(handler); return () => {}; }
  onDisconnect(handler) { this.disconnectHandlers.push(handler); return () => {}; }
  onError(handler) { this.errorHandlers.push(handler); return () => {}; }
  emitDiscover(peripheral) { for (const handler of this.discoverHandlers) handler(peripheral); }
  emitNotification(event) { for (const handler of this.notificationHandlers) handler(event); }
  emitDisconnect(id) { for (const handler of this.disconnectHandlers) handler(id); }
  emitError(error) { for (const handler of this.errorHandlers) handler(error); }
}

function runtime(proofs) {
  return {
    deviceId: 'ble-integration',
    capabilities: {},
    ports: { proof: { async createProof(proof) { proofs.push(proof); return { ok: true }; } } },
  };
}

const PERIPHERAL = { id: 'aa:bb', address: 'aa:bb', name: 'sensor', rssi: -40, services: ['180f'] };

test('BLE gateway and bridge exercise scanning, GATT operations, notifications and teardown', async () => {
  const transport = new SimulatedBle();
  const proofs = [];
  const gateway = createBleGateway({ runtime: runtime(proofs), transport, scanServices: ['180f'] });
  await gateway.start();
  assert.deepEqual(transport.scanning, [['180f']]);
  assert.equal(gateway.status, 'running');

  transport.emitDiscover(PERIPHERAL);
  assert.equal(gateway.peripherals.length, 1);

  await gateway.connect(PERIPHERAL.id);
  assert.equal(transport.connected.has(PERIPHERAL.id), true);

  const read = await gateway.read(PERIPHERAL.id, '180f', '2a19');
  assert.equal(read.ok, true);
  assert.deepEqual([...read.data.value], [21, 5]);

  const missing = await gateway.read(PERIPHERAL.id, '180f', 'missing');
  assert.equal(missing.ok, false);
  assert.match(missing.error, /not found/);

  const write = await gateway.write(PERIPHERAL.id, '180f', '2a19', Uint8Array.of(1, 2));
  assert.equal(write.ok, true);
  assert.deepEqual(transport.writes[0].data, [1, 2]);

  const subscribe = await gateway.subscribe(PERIPHERAL.id, '180f', '2a19');
  assert.equal(subscribe.ok, true);

  transport.emitNotification({ peripheralId: PERIPHERAL.id, serviceUuid: '180f', characteristicUuid: '2a19', value: Uint8Array.of(7), receivedAt: 1000 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(proofs.some((proof) => proof.subject === `ble:${PERIPHERAL.id}`));

  const bridge = createBleSensorBridge({
    runtime: runtime(proofs),
    transport,
    bindings: [{ sensorId: 'battery', peripheralId: PERIPHERAL.id, serviceUuid: '180f', characteristicUuid: '2a19', dataType: 'battery' }],
  });
  await bridge.start();
  assert.equal(transport.connected.has(PERIPHERAL.id), true);
  assert.ok(transport.subscriptions.some((entry) => entry.characteristic === '2a19'));
  transport.emitNotification({ peripheralId: PERIPHERAL.id, serviceUuid: '180f', characteristicUuid: '2a19', value: Uint8Array.of(9), receivedAt: 2000 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(proofs.some((proof) => proof.subject === 'sensor:battery' && proof.claims[0].value[0] === 9));
  await bridge.poll();
  await bridge.stop();
  assert.equal(transport.connected.has(PERIPHERAL.id), false);

  transport.emitDisconnect(PERIPHERAL.id);
  assert.equal(gateway.peripherals.length, 0);

  transport.emitError(new Error('adapter reset'));
  assert.equal(gateway.status, 'error');

  await gateway.stop();
  assert.equal(transport.stopped, true);
  assert.equal(gateway.status, 'stopped');
  await gateway.stop();
});
