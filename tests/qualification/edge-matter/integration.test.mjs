import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMatterGateway } from '../../../packages/edge-matter/dist/gateway.js';
import { createMatterSensorBridge } from '../../../packages/edge-matter/dist/sensor-bridge.js';

class SimulatedMatter {
  inited;
  shutdownCalled = false;
  subscriptions = [];
  commissionedHandlers = [];
  errorHandlers = [];
  writes = [];
  commands = [];
  decommissioned = [];

  async init(vendorId, productId) { this.inited = { vendorId, productId }; }
  async shutdown() { this.shutdownCalled = true; }
  async commission(device, setupCode) {
    if (setupCode !== 'valid') throw new Error('invalid setup code');
    return { nodeId: 'node-1', vendorId: device.vendorId, productId: device.productId, endpoints: [] };
  }
  async decommission(nodeId) { this.decommissioned.push(nodeId); }
  async readAttribute(nodeId, endpointId, clusterId, attributeId) {
    if (attributeId === 99) throw new Error('attribute not found');
    return { nodeId, endpointId, clusterId, attributeId, value: 21.5, dataType: 'int16', receivedAt: Date.now() };
  }
  async writeAttribute(nodeId, endpointId, clusterId, attributeId, value) {
    this.writes.push({ nodeId, endpointId, clusterId, attributeId, value });
  }
  async subscribe(nodeId, endpointId, clusterId, attributeIds, minInterval, maxInterval) {
    const handlers = [];
    const entry = { nodeId, endpointId, clusterId, attributeIds, minInterval, maxInterval, handlers, cancelled: false };
    entry.subscription = {
      onChange(handler) { handlers.push(handler); return () => {}; },
      async cancel() { entry.cancelled = true; },
    };
    this.subscriptions.push(entry);
    return entry.subscription;
  }
  async invokeCommand(nodeId, endpointId, clusterId, commandId, args) {
    this.commands.push({ nodeId, endpointId, clusterId, commandId, args });
    return { status: 'ok' };
  }
  onCommissioned(handler) { this.commissionedHandlers.push(handler); return () => {}; }
  onError(handler) { this.errorHandlers.push(handler); return () => {}; }
  emitCommissioned(node) { for (const handler of this.commissionedHandlers) handler(node); }
  emitReports(reports) { for (const entry of this.subscriptions) for (const handler of entry.handlers) handler(reports); }
  emitError(error) { for (const handler of this.errorHandlers) handler(error); }
}

function runtime(proofs) {
  return {
    deviceId: 'matter-integration',
    capabilities: {},
    ports: { proof: { async createProof(proof) { proofs.push(proof); return { ok: true }; } } },
  };
}

test('Matter gateway and bridge exercise commissioning, attributes, commands and teardown', async () => {
  const transport = new SimulatedMatter();
  const proofs = [];
  const gateway = createMatterGateway({
    runtime: runtime(proofs),
    transport,
    vendorId: 0xfff1,
    productId: 0x8000,
    subscriptions: [{ nodeId: 'node-1', endpointId: 1, clusterId: 0x0402, attributeIds: [0x0000], sensorId: 'room-temp', minInterval: 1, maxInterval: 60 }],
  });

  await gateway.start();
  assert.deepEqual(transport.inited, { vendorId: 0xfff1, productId: 0x8000 });
  assert.equal(transport.subscriptions.length, 1);
  assert.equal(gateway.status, 'running');

  transport.emitCommissioned({ nodeId: 'node-1', vendorId: 0xfff1, productId: 0x8000, endpoints: [] });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(proofs.some((proof) => proof.subject === 'matter:commissioned'));

  const commissioned = await gateway.commission(1234, 'valid');
  assert.equal(commissioned.ok, true);
  assert.equal(commissioned.data.node.nodeId, 'node-1');
  const refused = await gateway.commission(1234, 'bad');
  assert.equal(refused.ok, false);
  assert.match(refused.error, /invalid setup code/);
  await transport.decommission('node-1');
  assert.deepEqual(transport.decommissioned, ['node-1']);

  const read = await gateway.readAttribute('node-1', 1, 0x0402, 0);
  assert.equal(read.ok, true);
  assert.equal(read.data.value.value, 21.5);
  const missing = await gateway.readAttribute('node-1', 1, 0x0402, 99);
  assert.equal(missing.ok, false);
  assert.match(missing.error, /not found/);

  const write = await gateway.writeAttribute('node-1', 1, 0x0402, 0, 22);
  assert.equal(write.ok, true);
  assert.equal(transport.writes[0].value, 22);

  const command = await gateway.invokeCommand('node-1', 1, 0x0006, 0x01, { on: true });
  assert.equal(command.ok, true);
  assert.deepEqual(transport.commands[0].args, { on: true });

  transport.emitReports([{ nodeId: 'node-1', endpointId: 1, clusterId: 0x0402, attributeId: 0, value: 23, dataType: 'int16', receivedAt: 1000 }]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(proofs.some((proof) => proof.subject === 'sensor:room-temp' && proof.claims[0].value === 23));

  const bridge = createMatterSensorBridge({
    runtime: runtime(proofs),
    transport,
    bindings: [{ sensorId: 'polled-temp', nodeId: 'node-1', endpointId: 1, clusterId: 0x0402, attributeId: 0, intervalMs: 60_000 }],
  });
  await bridge.poll();
  assert.ok(proofs.some((proof) => proof.subject === 'sensor:polled-temp'));
  await bridge.stop();

  transport.emitError(new Error('fabric lost'));
  assert.equal(gateway.status, 'error');

  await gateway.stop();
  assert.equal(transport.subscriptions[0].cancelled, true);
  assert.equal(transport.shutdownCalled, true);
  assert.equal(gateway.status, 'stopped');
  await gateway.stop();
});
