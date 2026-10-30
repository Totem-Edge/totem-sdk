import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLorawanGateway, createMemoryLorawanReplayStore } from '../dist/index.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

class SimulatorTransport {
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

const runtime = (proof) => ({ deviceId: 'sim', capabilities: {}, ports: { proof } });
function makeProof() {
  const calls = [];
  return { calls, createProof: async (params) => { calls.push(params); return { ok: true }; } };
}
const message = (frameCounter, overrides = {}) => ({
  port: 2, payload: Uint8Array.of(1, 2), confirmed: false, frameCounter,
  snr: 7, rssi: -90, receivedAt: Date.now(), ...overrides,
});

test('frame-counter simulator rejects duplicate/rollback, then rejoin resets', async (t) => {
  const transport = new SimulatorTransport();
  const proof = makeProof();
  const gateway = createLorawanGateway({
    runtime: runtime(proof), transport, replayStore: createMemoryLorawanReplayStore(),
    abp: { devAddr: '26011F7D', nwkSKey: 'n', appSKey: 'a' },
  });
  t.after(() => gateway.stop());
  await gateway.start();
  transport.emitDownlink(message(10));
  transport.emitDownlink(message(10));
  transport.emitDownlink(message(9));
  await flush();
  assert.equal(proof.calls.length, 1);
  transport.emitDownlink(message(11));
  await flush();
  assert.equal(proof.calls.length, 2);
  assert.equal(proof.calls[1].claims[0].frameCounter, 11);
  transport.emitJoin('26011F7D');
  await flush();
  assert.equal(proof.calls.at(-1).subject, 'lorawan:join');
  transport.emitDownlink(message(1));
  await flush();
  assert.equal(proof.calls.at(-1).claims[0].frameCounter, 1);
});

test('unbound frames fail closed', async (t) => {
  const transport = new SimulatorTransport();
  const proof = makeProof();
  const gateway = createLorawanGateway({
    runtime: runtime(proof), transport, replayStore: createMemoryLorawanReplayStore(),
    otaa: { devEui: 'e', appEui: 'a', appKey: 'k' },
  });
  t.after(() => gateway.stop());
  await gateway.start();
  transport.emitDownlink(message(1));
  await flush();
  assert.equal(proof.calls.length, 0);
});

test('invalid frame counters cannot advance the session', async () => {
  const store = createMemoryLorawanReplayStore();
  await store.beginSession('dev', 1);
  assert.equal(await store.claimFrame('dev', -1, 2), false);
  assert.equal(await store.claimFrame('dev', 1.5, 3), false);
  assert.equal(await store.claimFrame('dev', 0, 4), true);
  assert.equal(await store.claimFrame('dev', 0, 5), false);
});
