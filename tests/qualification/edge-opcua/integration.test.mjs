import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOpcuaGateway } from '../../../packages/edge-opcua/dist/gateway.js';
import { createOpcuaSensorBridge } from '../../../packages/edge-opcua/dist/sensor-bridge.js';

class SimulatedOpcua {
  endpoint;
  connected = false;
  written = [];
  subscriptions = [];
  calls = [];
  errorHandlers = [];

  async connect(endpoint) { this.endpoint = endpoint; this.connected = true; }
  async disconnect() { this.connected = false; }
  async browse(nodeId) {
    if (nodeId === 'missing') throw new Error('node not found');
    return [{ nodeId: 'ns=2;s=Temp', browseName: 'Temp', displayName: 'Temperature', nodeClass: 'Variable', dataType: 'Double' }];
  }
  async read(nodeId) {
    if (nodeId === 'missing') throw new Error('node not found');
    return { value: 21.5, dataType: 'Double', sourceTimestamp: 1000 };
  }
  async write(nodeId, value) { this.written.push({ nodeId, value }); }
  async subscribe(nodeIds, interval) {
    const entry = { nodeIds: [...nodeIds], interval, handlers: [], destroyed: false };
    entry.subscription = {
      async addNodes(nodes) { entry.nodeIds.push(...nodes); },
      async removeNodes(nodes) { entry.nodeIds = entry.nodeIds.filter((node) => !nodes.includes(node)); },
      onChange(handler) { entry.handlers.push(handler); return () => {}; },
      async destroy() { entry.destroyed = true; },
    };
    this.subscriptions.push(entry);
    return entry.subscription;
  }
  async call(objectId, methodId, args) { this.calls.push({ objectId, methodId, args }); return [{ value: true, dataType: 'Boolean' }]; }
  onError(handler) { this.errorHandlers.push(handler); return () => {}; }
  emit(events) { for (const entry of this.subscriptions) for (const handler of entry.handlers) handler(events); }
  emitError(error) { for (const handler of this.errorHandlers) handler(error); }
}

function runtime(proofs) {
  return {
    deviceId: 'opcua-integration',
    capabilities: {},
    ports: { proof: { async createProof(proof) { proofs.push(proof); return { ok: true }; } } },
  };
}

test('OPC-UA gateway and bridge exercise browse, reads, writes, calls, subscriptions and teardown', async () => {
  const transport = new SimulatedOpcua();
  const proofs = [];
  const gateway = createOpcuaGateway({
    runtime: runtime(proofs),
    transport,
    endpointUrl: 'opc.tcp://127.0.0.1:4840',
    subscriptions: [{ nodeId: 'ns=2;s=Temp', sensorId: 'line-temp', samplingInterval: 500 }],
  });

  await gateway.start();
  assert.equal(transport.endpoint, 'opc.tcp://127.0.0.1:4840');
  assert.equal(transport.subscriptions.length, 1);
  assert.equal(transport.subscriptions[0].interval, 500);
  assert.equal(gateway.status, 'running');

  const browse = await gateway.browse('ns=0;i=85');
  assert.equal(browse.ok, true);
  assert.equal(browse.data.nodes[0].browseName, 'Temp');
  const missing = await gateway.browse('missing');
  assert.equal(missing.ok, false);
  assert.match(missing.error, /not found/);

  const read = await gateway.read('ns=2;s=Temp');
  assert.equal(read.ok, true);
  assert.equal(read.data.value.value, 21.5);

  const write = await gateway.write('ns=2;s=Setpoint', { value: 22, dataType: 'Double' });
  assert.equal(write.ok, true);
  assert.equal(transport.written[0].value.value, 22);

  const call = await gateway.call('ns=2;s=Device', 'ns=2;s=Reset', [{ value: 1, dataType: 'Int32' }]);
  assert.equal(call.ok, true);
  assert.equal(call.data.results[0].value, true);

  transport.emit([{ nodeId: 'ns=2;s=Temp', value: { value: 23, dataType: 'Double', sourceTimestamp: 2000 }, receivedAt: 3000 }]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(proofs.some((proof) => proof.subject === 'sensor:line-temp' && proof.claims[0].value === 23));

  const bridge = createOpcuaSensorBridge({
    runtime: runtime(proofs),
    transport,
    bindings: [{ sensorId: 'polled-temp', nodeId: 'ns=2;s=Temp', intervalMs: 60_000 }],
  });
  await bridge.poll();
  assert.ok(proofs.some((proof) => proof.subject === 'sensor:polled-temp' && proof.claims[0].value === 21.5));
  await bridge.stop();

  transport.emitError(new Error('secure channel closed'));
  assert.equal(gateway.status, 'error');

  await gateway.stop();
  assert.equal(transport.subscriptions[0].destroyed, true);
  assert.equal(transport.connected, false);
  assert.equal(gateway.status, 'stopped');
  await gateway.stop();
});
