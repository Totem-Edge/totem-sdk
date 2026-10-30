import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLorawanGateway, createLorawanSensorBridge, createMemoryLorawanReplayStore } from '../dist/index.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

class Simulator {
  handlers = { downlink: [], join: [], error: [] };
  confirmed = [];
  unconfirmed = [];
  async joinOtaa() {}
  async activateAbp() {}
  async sendConfirmed(port, data) { this.confirmed.push({ port, data }); }
  async sendUnconfirmed(port, data) { this.unconfirmed.push({ port, data }); }
  onDownlink(handler) { this.handlers.downlink.push(handler); return () => { this.handlers.downlink = this.handlers.downlink.filter((h) => h !== handler); }; }
  onJoin(handler) { this.handlers.join.push(handler); return () => { this.handlers.join = this.handlers.join.filter((h) => h !== handler); }; }
  onError(handler) { this.handlers.error.push(handler); return () => { this.handlers.error = this.handlers.error.filter((h) => h !== handler); }; }
  emitDownlink(message) { for (const handler of this.handlers.downlink) handler(message); }
  emitJoin(devAddr) { for (const handler of this.handlers.join) handler(devAddr); }
}

const runtime = (proof) => ({ deviceId: 'integration', capabilities: {}, ports: { proof } });
const makeProof = () => {
  const calls = [];
  return { calls, createProof: async (params) => { calls.push(params); return { ok: true }; } };
};

test('gateway + bridge: join, duplicate downlink, poll uplink, teardown', async (t) => {
  const transport = new Simulator();
  const gatewayProof = makeProof();
  const bridgeProof = makeProof();
  const gateway = createLorawanGateway({
    runtime: runtime(gatewayProof), transport, replayStore: createMemoryLorawanReplayStore(),
    abp: { devAddr: '26011F7D', nwkSKey: 'n', appSKey: 'a' },
  });
  const bridge = createLorawanSensorBridge({
    runtime: runtime(bridgeProof), transport, devAddr: '26011F7D', replayStore: createMemoryLorawanReplayStore(),
    bindings: [{ sensorId: 'soil', port: 2, intervalMs: 60_000, unit: '%' }],
  });
  t.after(async () => { await gateway.stop(); await bridge.stop(); });
  await gateway.start();
  await bridge.start();
  const frame = { port: 2, payload: Uint8Array.of(1, 2), confirmed: true, frameCounter: 4, snr: 8, rssi: -80, receivedAt: Date.now() };
  transport.emitDownlink(frame);
  transport.emitDownlink(frame);
  await flush();
  assert.equal(gatewayProof.calls.length, 1);
  assert.equal(bridgeProof.calls.length, 1);
  assert.equal(gatewayProof.calls[0].subject, 'lorawan:downlink');
  assert.equal(bridgeProof.calls[0].subject, 'sensor:soil');
  assert.equal(bridgeProof.calls[0].claims[0].devAddr, '26011F7D');

  transport.emitJoin('26011F7D');
  await flush();
  assert.ok(gatewayProof.calls.some((call) => call.subject === 'lorawan:join'));
  await bridge.poll();
  assert.deepEqual(transport.confirmed, [{ port: 2, data: Uint8Array.of(0) }]);

  await bridge.stop();
  await gateway.stop();
  const before = gatewayProof.calls.length + bridgeProof.calls.length;
  transport.emitDownlink({ ...frame, frameCounter: 5 });
  await flush();
  assert.equal(gatewayProof.calls.length + bridgeProof.calls.length, before);
});
