import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOcppGateway } from '../../../packages/edge-ocpp/dist/gateway.js';
import { createOcppSensorBridge } from '../../../packages/edge-ocpp/dist/sensor-bridge.js';
import { encodeCall, encodeCallResult, parseOcppFrame } from '../../../packages/edge-ocpp/dist/ocpp.js';

class SimulatedCsms {
  connected = false;
  sent = [];
  messageHandlers = [];
  closeHandlers = [];
  errorHandlers = [];
  autoRespond = true;

  async connect() { this.connected = true; }
  async close() { this.connected = false; }
  async send(message) {
    this.sent.push(parseOcppFrame(message));
    if (!this.autoRespond) return;
    const frame = parseOcppFrame(message);
    if (frame.type !== 2) return;
    if (frame.action === 'BootNotification') {
      this.emit(encodeCallResult(frame.messageId, { status: 'Accepted', currentTime: new Date().toISOString(), interval: 300 }));
    } else if (frame.action === 'Heartbeat') {
      this.emit(encodeCallResult(frame.messageId, { currentTime: new Date().toISOString() }));
    } else if (frame.action === 'Authorize') {
      this.emit(encodeCallResult(frame.messageId, { idTagInfo: { status: 'Accepted' } }));
    } else if (frame.action === 'MeterValues') {
      this.emit(encodeCallResult(frame.messageId, {}));
    }
  }
  onMessage(handler) { this.messageHandlers.push(handler); return () => {}; }
  onClose(handler) { this.closeHandlers.push(handler); return () => {}; }
  onError(handler) { this.errorHandlers.push(handler); return () => {}; }
  emit(message) { for (const handler of this.messageHandlers) handler(message); }
  emitClose() { for (const handler of this.closeHandlers) handler(); }
}

function runtime(proofs) {
  return {
    deviceId: 'ocpp-integration',
    capabilities: {},
    ports: { proof: { async createProof(proof) { proofs.push(proof); return { ok: true }; } } },
  };
}

test('OCPP gateway and bridge boot, authorize, handle remote commands and publish meter values', async () => {
  const transport = new SimulatedCsms();
  const proofs = [];
  const gateway = createOcppGateway({
    runtime: runtime(proofs),
    transport,
    url: 'ws://csms.test/ocpp/CP-1',
    chargePointId: 'CP-1',
    heartbeatIntervalMs: 0,
  });

  await gateway.start();
  assert.equal(gateway.status, 'running');
  assert.equal(transport.connected, true);
  assert.equal(transport.sent[0].type, 2);
  if (transport.sent[0].type === 2) {
    assert.equal(transport.sent[0].action, 'BootNotification');
    assert.equal(transport.sent[0].payload.chargePointVendor, 'Totem');
  }

  const authorize = await gateway.authorize('tag-1');
  assert.equal(authorize.ok, true);
  const authorizeFrame = transport.sent.find((frame) => frame.type === 2 && frame.action === 'Authorize');
  assert.ok(authorizeFrame);

  const remoteStarts = [];
  gateway.onCall('RemoteStartTransaction', async (payload) => {
    remoteStarts.push(payload.idTag);
    if (payload.idTag !== 'allowed') return { status: 'Rejected' };
    return { status: 'Accepted' };
  });
  transport.emit(encodeCall('csms-1', 'RemoteStartTransaction', { idTag: 'allowed' }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  transport.emit(encodeCall('csms-2', 'RemoteStartTransaction', { idTag: 'denied' }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(remoteStarts, ['allowed', 'denied']);
  const results = transport.sent.filter((frame) => frame.type === 3);
  assert.ok(results.length >= 2); // two RemoteStartTransaction responses

  const bridge = createOcppSensorBridge({
    runtime: runtime(proofs),
    gateway,
    bindings: [{
      sensorId: 'energy-meter', connectorId: 1, intervalMs: 60_000,
      read: async () => [{ value: 7.25, unit: 'kWh', measurand: 'Energy.Active.Import.Register', transactionId: 42 }],
    }],
  });
  await bridge.poll();
  assert.ok(proofs.some((proof) => proof.subject === 'sensor:energy-meter' && proof.claims[0].value === 7.25));
  const meterFrame = transport.sent.find((frame) => frame.type === 2 && frame.action === 'MeterValues');
  assert.ok(meterFrame);
  await bridge.stop();

  transport.emitClose();
  assert.equal(gateway.status, 'error');

  await gateway.stop();
  assert.equal(transport.connected, false);
  assert.equal(gateway.status, 'stopped');
  await gateway.stop();
});
