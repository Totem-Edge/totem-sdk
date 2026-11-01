import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMavlinkGateway } from '../../../packages/edge-mavlink/dist/gateway.js';
import { createMavlinkSensorBridge } from '../../../packages/edge-mavlink/dist/sensor-bridge.js';
import { decodeFrames, encodeFrame, MESSAGE_IDS } from '../../../packages/edge-mavlink/dist/codec.js';

class SimulatedVehicle {
  started = 0;
  stopped = 0;
  dataHandlers = [];
  errorHandlers = [];
  sentFrames = [];

  async start() { this.started++; }
  async stop() { this.stopped++; }
  async send(bytes) {
    const frame = decodeFrames(bytes).frames[0];
    if (!frame) return;
    this.sentFrames.push(frame);
    if (frame.messageId === MESSAGE_IDS.COMMAND_LONG) {
      const command = new DataView(frame.payload.buffer, frame.payload.byteOffset).getUint16(28, true);
      const ack = new Uint8Array(10);
      const view = new DataView(ack.buffer);
      view.setUint16(0, command, true);
      ack[2] = 0;
      this.emit(encodeFrame(2, 0, 1, 1, MESSAGE_IDS.COMMAND_ACK, ack));
    }
  }
  onData(handler) { this.dataHandlers.push(handler); return () => {}; }
  onError(handler) { this.errorHandlers.push(handler); return () => {}; }
  emit(bytes) { for (const handler of this.dataHandlers) handler(bytes); }
  emitError(error) { for (const handler of this.errorHandlers) handler(error); }
  telemetry(lat, lon, satellites) {
    const payload = new Uint8Array(30);
    const view = new DataView(payload.buffer);
    view.setInt32(8, Math.round(lat * 1e7), true);
    view.setInt32(12, Math.round(lon * 1e7), true);
    view.setInt32(16, 120_000, true);
    payload[28] = 3;
    payload[29] = satellites;
    return encodeFrame(2, 1, 42, 1, MESSAGE_IDS.GPS_RAW_INT, payload);
  }
}

function runtime(proofs) {
  return {
    deviceId: 'mavlink-integration',
    capabilities: {},
    ports: { proof: { async createProof(proof) { proofs.push(proof); return { ok: true }; } } },
  };
}

test('MAVLink gateway and bridge handle telemetry, commands, fragmentation, errors and teardown', async () => {
  const transport = new SimulatedVehicle();
  const proofs = [];
  const gateway = createMavlinkGateway({
    runtime: runtime(proofs),
    transport,
    systemId: 255,
    componentId: 190,
    targetSystemId: 42,
    targetComponentId: 1,
    heartbeatIntervalMs: 0,
  });
  await gateway.start();
  assert.equal(transport.started, 1);
  assert.equal(gateway.status, 'running');

  const bridge = createMavlinkSensorBridge({
    runtime: runtime(proofs),
    gateway,
    bindings: [{
      sensorId: 'drone-position',
      messageId: MESSAGE_IDS.GPS_RAW_INT,
      dataType: 'gps',
      extract: (message) => ({ lat: message.decoded.lat, lon: message.decoded.lon, satellites: message.decoded.satellites }),
    }],
  });
  await bridge.start();

  const frame = transport.telemetry(48.1173, 11.5167, 12);
  transport.emit(frame.slice(0, 5));
  transport.emit(frame.slice(5));
  await new Promise((resolve) => setTimeout(resolve, 0));
  const proof = proofs.find((entry) => entry.subject === 'sensor:drone-position');
  assert.ok(proof);
  assert.equal(proof.claims[0].value.satellites, 12);
  assert.ok(Math.abs(proof.claims[0].value.lat - 48.1173) < 1e-4);

  const command = await gateway.command(400, [1, 0, 0, 0, 0, 0, 0]);
  assert.equal(command.ok, true);
  assert.equal(command.data.result, 0);
  const commandFrame = transport.sentFrames.find((entry) => entry.messageId === MESSAGE_IDS.COMMAND_LONG);
  assert.ok(commandFrame);
  assert.equal(commandFrame.payload[30], 42, 'target system');

  transport.emitError(new Error('radio link lost'));
  assert.equal(gateway.status, 'error');

  await bridge.stop();
  await gateway.stop();
  assert.equal(transport.stopped, 1);
  assert.equal(gateway.status, 'stopped');
  await gateway.stop();
});
