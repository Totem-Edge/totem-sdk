import { createMavlinkGateway } from '../gateway.js';
import { createMavlinkSensorBridge } from '../sensor-bridge.js';
import { decodeFrames, encodeFrame, MESSAGE_IDS } from '../codec.js';
import type { MavlinkTransportPort } from '../transport.js';
import type { EdgeRuntime } from '@totemsdk/edge';

class MockMavlinkTransport implements MavlinkTransportPort {
  started = 0;
  stopped = 0;
  sent: Uint8Array[] = [];
  dataHandlers: Array<(bytes: Uint8Array) => void> = [];
  errorHandlers: Array<(error: Error) => void> = [];

  async start() { this.started++; }
  async stop() { this.stopped++; }
  async send(bytes: Uint8Array) { this.sent.push(bytes); }
  onData(handler: (bytes: Uint8Array) => void) { this.dataHandlers.push(handler); return () => {}; }
  onError(handler: (error: Error) => void) { this.errorHandlers.push(handler); return () => {}; }
  emit(bytes: Uint8Array) { for (const handler of this.dataHandlers) handler(bytes); }
  emitError(error: Error) { for (const handler of this.errorHandlers) handler(error); }
}

function ackFrame(command: number, result: number): Uint8Array {
  const payload = new Uint8Array(10);
  const view = new DataView(payload.buffer);
  view.setUint16(0, command, true);
  payload[2] = result;
  return encodeFrame(2, 0, 1, 1, MESSAGE_IDS.COMMAND_ACK, payload);
}

function runtime(proofs: Array<Record<string, unknown>> = []) {
  return {
    deviceId: 'mavlink-1',
    capabilities: {},
    ports: { proof: { async createProof(proof: Record<string, unknown>) { proofs.push(proof); return { ok: true }; } } },
  } as unknown as EdgeRuntime;
}

describe('MAVLink gateway', () => {
  it('starts, emits heartbeats, dispatches telemetry and stops', async () => {
    const transport = new MockMavlinkTransport();
    const gateway = createMavlinkGateway({
      runtime: runtime(), transport, systemId: 1, componentId: 1,
      heartbeatIntervalMs: 10, targetSystemId: 42,
    });
    await gateway.start();
    expect(transport.started).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(transport.sent.length).toBeGreaterThan(0);
    expect(decodeFrames(transport.sent[0]).frames[0].messageId).toBe(MESSAGE_IDS.HEARTBEAT);

    const received = [];
    gateway.onMessage(MESSAGE_IDS.GPS_RAW_INT, (message) => received.push(message));
    const payload = new Uint8Array(30);
    const view = new DataView(payload.buffer);
    view.setInt32(8, 481173000, true);
    view.setInt32(12, 115167000, true);
    payload[28] = 3;
    payload[29] = 8;
    transport.emit(encodeFrame(2, 1, 42, 1, MESSAGE_IDS.GPS_RAW_INT, payload));
    expect(received).toHaveLength(1);
    expect(received[0].decoded.satellites).toBe(8);

    await gateway.stop();
    expect(transport.stopped).toBe(1);
    expect(gateway.status).toBe('stopped');
    await gateway.stop();
  });

  it('correlates COMMAND_ACK and times out unanswered commands', async () => {
    const transport = new MockMavlinkTransport();
    const gateway = createMavlinkGateway({
      runtime: runtime(), transport, systemId: 1, componentId: 1,
      heartbeatIntervalMs: 0, targetSystemId: 42, commandTimeoutMs: 30,
    });
    await gateway.start();

    const accepted = gateway.command(400, [1, 0, 0, 0, 0, 0, 0]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const commandFrame = decodeFrames(transport.sent[0]).frames[0];
    expect(commandFrame.messageId).toBe(MESSAGE_IDS.COMMAND_LONG);
    transport.emit(ackFrame(400, 0));
    const result = await accepted;
    expect(result.ok).toBe(true);
    expect((result as { data: { result: number } }).data.result).toBe(0);

    const timedOut = await gateway.command(401);
    expect(timedOut.ok).toBe(false);
    expect(timedOut.error).toMatch(/timed out/);
    await gateway.stop();
  });

  it('flips status on transport errors', async () => {
    const transport = new MockMavlinkTransport();
    const gateway = createMavlinkGateway({ runtime: runtime(), transport, systemId: 1, componentId: 1, heartbeatIntervalMs: 0 });
    await gateway.start();
    transport.emitError(new Error('link lost'));
    expect(gateway.status).toBe('error');
    await gateway.stop();
  });
});

describe('MAVLink sensor bridge', () => {
  it('creates proofs from decoded telemetry', async () => {
    const transport = new MockMavlinkTransport();
    const proofs: Array<Record<string, unknown>> = [];
    const gateway = createMavlinkGateway({ runtime: runtime(proofs), transport, systemId: 1, componentId: 1, heartbeatIntervalMs: 0 });
    await gateway.start();
    const bridge = createMavlinkSensorBridge({
      runtime: runtime(proofs),
      gateway,
      bindings: [{ sensorId: 'position', messageId: MESSAGE_IDS.GPS_RAW_INT, dataType: 'gps', extract: (message) => message.decoded.satellites }],
    });
    await bridge.start();
    const payload = new Uint8Array(30);
    payload[29] = 11;
    transport.emit(encodeFrame(2, 1, 42, 1, MESSAGE_IDS.GPS_RAW_INT, payload));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(proofs[0].subject).toBe('sensor:position');
    expect((proofs[0].claims as Array<Record<string, unknown>>)[0].value).toBe(11);
    await bridge.stop();
    await gateway.stop();
  });
});
