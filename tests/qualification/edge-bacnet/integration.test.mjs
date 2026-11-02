import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBacnetGateway } from '../../../packages/edge-bacnet/dist/gateway.js';
import { createBacnetSensorBridge } from '../../../packages/edge-bacnet/dist/sensor-bridge.js';

class SimulatedBacnet {
  inited;
  closed = false;
  devices = [{ deviceId: 1, address: '192.0.2.10:47808', deviceName: 'AHU-1', vendorId: 7 }];
  writes = [];
  cov = [];
  discoverHandlers = [];
  errorHandlers = [];

  async init(deviceId, deviceName) { this.inited = { deviceId, deviceName }; }
  async close() { this.closed = true; }
  async discoverDevices() { return this.devices; }
  async readProperty(deviceId, objectType, objectInstance, propertyId) {
    if (propertyId === 99) throw new Error('no such property');
    return { objectType, objectInstance, propertyId, propertyName: 'present-value', value: 21.5, dataType: 'REAL' };
  }
  async writeProperty(deviceId, objectType, objectInstance, propertyId, value, priority) {
    this.writes.push({ deviceId, objectType, objectInstance, propertyId, value, priority });
  }
  async subscribeCov(deviceId, objectType, objectInstance, lifetime) {
    const handlers = [];
    const entry = { deviceId, objectType, objectInstance, lifetime, handlers, cancelled: false };
    entry.subscription = {
      onChange(handler) { handlers.push(handler); return () => {}; },
      async cancel() { entry.cancelled = true; },
    };
    this.cov.push(entry);
    return entry.subscription;
  }
  onDeviceDiscovered(handler) { this.discoverHandlers.push(handler); return () => {}; }
  onError(handler) { this.errorHandlers.push(handler); return () => {}; }
  emitDevice(device) { for (const handler of this.discoverHandlers) handler(device); }
  emitCov(event) { for (const entry of this.cov) for (const handler of entry.handlers) handler(event); }
  emitError(error) { for (const handler of this.errorHandlers) handler(error); }
}

function runtime(proofs) {
  return {
    deviceId: 'bacnet-integration',
    capabilities: {},
    ports: { proof: { async createProof(proof) { proofs.push(proof); return { ok: true }; } } },
  };
}

test('BACnet gateway and bridge exercise discovery, COV, writes and teardown', async () => {
  const transport = new SimulatedBacnet();
  const proofs = [];
  const gateway = createBacnetGateway({
    runtime: runtime(proofs),
    transport,
    deviceId: 1001,
    deviceName: 'edge-gateway',
    covSubscriptions: [{ deviceId: 1, objectType: 'analogInput', objectInstance: 0, sensorId: 'zone-temp', lifetime: 60 }],
  });

  await gateway.start();
  assert.deepEqual(transport.inited, { deviceId: 1001, deviceName: 'edge-gateway' });
  assert.equal(gateway.status, 'running');
  assert.equal(transport.cov.length, 1);

  transport.emitDevice(transport.devices[0]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(proofs[0].subject, 'bacnet:discovery');
  assert.equal(proofs[0].claims[0].deviceId, 1);

  const discovered = await gateway.discoverDevices();
  assert.equal(discovered.ok, true);
  assert.equal(discovered.data.devices.length, 1);

  const read = await gateway.readProperty(1, 'analogInput', 0, 85);
  assert.equal(read.ok, true);
  assert.equal(read.data.value.value, 21.5);

  const missing = await gateway.readProperty(1, 'analogInput', 0, 99);
  assert.equal(missing.ok, false);
  assert.match(missing.error, /no such property/);

  const write = await gateway.writeProperty(1, 'analogOutput', 0, 85, 12, 8);
  assert.equal(write.ok, true);
  assert.deepEqual(transport.writes[0], { deviceId: 1, objectType: 'analogOutput', objectInstance: 0, propertyId: 85, value: 12, priority: 8 });

  transport.emitCov({ deviceId: 1, objectType: 'analogInput', objectInstance: 0, propertyId: 85, newValue: 22, receivedAt: Date.now() });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const covProof = proofs.find((proof) => proof.subject === 'sensor:zone-temp');
  assert.ok(covProof);
  assert.equal(covProof.claims[0].newValue, 22);

  // Polling bridge reads the property directly and signs the value.
  const bridge = createBacnetSensorBridge({
    runtime: runtime(proofs),
    transport,
    bindings: [{ sensorId: 'polled-temp', deviceId: 1, objectType: 'analogInput', objectInstance: 0, propertyId: 85, intervalMs: 60_000 }],
  });
  await bridge.poll();
  assert.ok(proofs.some((proof) => proof.subject === 'sensor:polled-temp' && proof.claims[0].value === 21.5));
  await bridge.stop();

  transport.emitError(new Error('network down'));
  assert.equal(gateway.status, 'error');

  await gateway.stop();
  assert.equal(transport.cov[0].cancelled, true);
  assert.equal(transport.closed, true);
  assert.equal(gateway.status, 'stopped');
  await gateway.stop();
});
