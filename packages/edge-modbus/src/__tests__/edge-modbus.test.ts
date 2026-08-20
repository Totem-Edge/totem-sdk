import { createModbusGateway } from '../gateway.js';
import { createModbusSensorBridge } from '../sensor-bridge.js';
import type { ModbusTransportPort } from '../transport.js';
import type { EdgeRuntime } from '@totemsdk/edge';

class MockModbusTransport implements ModbusTransportPort {
  connectCalls = 0;
  disconnectCalls = 0;
  sent: Uint8Array[] = [];
  responses: Uint8Array[] = [];
  failConnect = false;
  failSend = false;
  frameHandlers: Array<(frame: Uint8Array) => void> = [];
  errorHandlers: Array<(err: Error) => void> = [];

  async connect() { this.connectCalls++; if (this.failConnect) throw new Error('connect failed'); }
  async disconnect() { this.disconnectCalls++; }
  async sendFrame(frame: Uint8Array) {
    this.sent.push(frame);
    if (this.failSend) throw new Error('send failed');
    const next = this.responses.shift();
    if (!next) throw new Error('no response queued');
    return next;
  }
  onFrame(handler: (frame: Uint8Array) => void) { this.frameHandlers.push(handler); return () => { this.frameHandlers = this.frameHandlers.filter(h => h !== handler); }; }
  onError(handler: (err: Error) => void) { this.errorHandlers.push(handler); return () => { this.errorHandlers = this.errorHandlers.filter(h => h !== handler); }; }
  emitError(err: Error) { for (const h of this.errorHandlers) h(err); }
}

function makeRuntime(proof?: { createProof: jest.Mock }) {
  return { deviceId: 'd1', capabilities: {}, ports: { proof } } as unknown as EdgeRuntime;
}

function makeProof() {
  return { createProof: jest.fn(async () => ({ ok: true, data: { proofId: 'p1', proof: {} } })) };
}

describe('edge-modbus gateway', () => {
  it('starts and reports running status, then stops', async () => {
    const transport = new MockModbusTransport();
    const gw = createModbusGateway({ runtime: makeRuntime(), transport });
    expect(gw.status).toBe('stopped');
    await gw.start();
    expect(transport.connectCalls).toBe(1);
    expect(gw.status).toBe('running');
    await gw.stop();
    expect(transport.disconnectCalls).toBe(1);
    expect(gw.status).toBe('stopped');
  });

  it('start is a no-op when already running', async () => {
    const transport = new MockModbusTransport();
    const gw = createModbusGateway({ runtime: makeRuntime(), transport });
    await gw.start();
    await gw.start();
    expect(transport.connectCalls).toBe(1);
  });

  it('start propagates connect failures', async () => {
    const transport = new MockModbusTransport();
    transport.failConnect = true;
    const gw = createModbusGateway({ runtime: makeRuntime(), transport });
    await expect(gw.start()).rejects.toThrow('connect failed');
  });

  it('readCoils builds an RTU read frame (FC1) and parses bit response', async () => {
    const transport = new MockModbusTransport();
    transport.responses.push(new Uint8Array([1, 1, 1, 0x0A]));
    const gw = createModbusGateway({ runtime: makeRuntime(), transport });
    const res = await gw.readCoils(1, 10, 4);
    expect(Array.from(transport.sent[0])).toEqual([1, 1, 0, 10, 0, 4, 0, 0]);
    expect(res).toEqual({ ok: true, data: { values: [false, true, false, true] } });
  });

  it('readDiscreteInputs uses FC2', async () => {
    const transport = new MockModbusTransport();
    transport.responses.push(new Uint8Array([1, 2, 1, 0x01]));
    const gw = createModbusGateway({ runtime: makeRuntime(), transport });
    const res = await gw.readDiscreteInputs(1, 3, 3);
    expect(transport.sent[0][1]).toBe(2);
    expect(res).toEqual({ ok: true, data: { values: [true, false, false] } });
  });

  it('readHoldingRegisters uses FC3 and parses big-endian registers', async () => {
    const transport = new MockModbusTransport();
    transport.responses.push(new Uint8Array([1, 3, 4, 0x01, 0x02, 0x03, 0x04]));
    const gw = createModbusGateway({ runtime: makeRuntime(), transport });
    const res = await gw.readHoldingRegisters(1, 100, 2);
    expect(transport.sent[0][1]).toBe(3);
    expect(res).toEqual({ ok: true, data: { values: [0x0102, 0x0304] } });
  });

  it('readInputRegisters uses FC4', async () => {
    const transport = new MockModbusTransport();
    transport.responses.push(new Uint8Array([1, 4, 2, 0xAB, 0xCD]));
    const gw = createModbusGateway({ runtime: makeRuntime(), transport });
    const res = await gw.readInputRegisters(7, 50, 1);
    expect(transport.sent[0][1]).toBe(4);
    expect(res).toEqual({ ok: true, data: { values: [0xABCD] } });
  });

  it('writeSingleCoil encodes FC5 with 0xFF00 for true and 0x0000 for false', async () => {
    const transport = new MockModbusTransport();
    transport.responses.push(new Uint8Array([1, 5, 0, 20, 0xFF, 0, 0, 0]));
    transport.responses.push(new Uint8Array([1, 5, 0, 20, 0x00, 0, 0, 0]));
    const gw = createModbusGateway({ runtime: makeRuntime(), transport });
    const on = await gw.writeSingleCoil(1, 20, true);
    const off = await gw.writeSingleCoil(1, 20, false);
    expect(Array.from(transport.sent[0])).toEqual([1, 5, 0, 20, 0xFF, 0x00, 0, 0]);
    expect(Array.from(transport.sent[1])).toEqual([1, 5, 0, 20, 0x00, 0x00, 0, 0]);
    expect(on).toEqual({ ok: true });
    expect(off).toEqual({ ok: true });
  });

  it('writeSingleRegister encodes FC6 with the register value', async () => {
    const transport = new MockModbusTransport();
    transport.responses.push(new Uint8Array([1, 6, 0, 30, 0x12, 0x34, 0, 0]));
    const gw = createModbusGateway({ runtime: makeRuntime(), transport });
    const res = await gw.writeSingleRegister(1, 30, 0x1234);
    expect(Array.from(transport.sent[0])).toEqual([1, 6, 0, 30, 0x12, 0x34, 0, 0]);
    expect(res).toEqual({ ok: true });
  });

  it('writeMultipleCoils encodes FC15 with packed bit data', async () => {
    const transport = new MockModbusTransport();
    transport.responses.push(new Uint8Array([1, 15, 0, 40, 0, 8, 1, 0]));
    const gw = createModbusGateway({ runtime: makeRuntime(), transport });
    const res = await gw.writeMultipleCoils(1, 40, [true, false, true, false, false, false, false, true]);
    expect(Array.from(transport.sent[0])).toEqual([1, 15, 0, 40, 0, 8, 1, 0b10000101]);
    expect(res).toEqual({ ok: true });
  });

  it('writeMultipleRegisters encodes FC16 with byte count and values', async () => {
    const transport = new MockModbusTransport();
    transport.responses.push(new Uint8Array([1, 16, 0, 50, 0, 2, 4, 0]));
    const gw = createModbusGateway({ runtime: makeRuntime(), transport });
    const res = await gw.writeMultipleRegisters(1, 50, [0x1111, 0x2222]);
    expect(Array.from(transport.sent[0])).toEqual([1, 16, 0, 50, 0, 2, 4, 0x11, 0x11, 0x22, 0x22]);
    expect(res).toEqual({ ok: true });
  });

  it('maps a Modbus exception response to an error result', async () => {
    const transport = new MockModbusTransport();
    transport.responses.push(new Uint8Array([1, 0x81, 0x02]));
    const gw = createModbusGateway({ runtime: makeRuntime(), transport });
    const res = await gw.readCoils(1, 0, 1);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('Modbus exception');
    expect(res.error).toContain('code=2');
  });

  it('maps transport failures to error results', async () => {
    const transport = new MockModbusTransport();
    transport.failSend = true;
    const gw = createModbusGateway({ runtime: makeRuntime(), transport });
    const res = await gw.readCoils(1, 0, 1);
    expect(res).toEqual({ ok: false, error: 'Error: send failed' });
  });

  it('transport errors flip status to error', async () => {
    const transport = new MockModbusTransport();
    const gw = createModbusGateway({ runtime: makeRuntime(), transport });
    await gw.start();
    transport.emitError(new Error('adapter reset'));
    expect(gw.status).toBe('error');
    await gw.stop();
  });
});

describe('edge-modbus sensor bridge', () => {
  it('poll creates proofs with parsed register values', async () => {
    const transport = new MockModbusTransport();
    transport.responses.push(new Uint8Array([1, 3, 4, 0x01, 0x02, 0x03, 0x04]));
    const proof = makeProof();
    const bridge = createModbusSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [{ sensorId: 'temp1', unitId: 1, functionCode: 3, address: 100, count: 2, intervalMs: 1000, dataType: 'register', unit: 'degC' }],
    });
    await bridge.poll();
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0][1]).toBe(3);
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'sensor:temp1',
      claims: [expect.objectContaining({ sensorId: 'temp1', unitId: 1, values: [0x0102, 0x0304], unit: 'degC' })],
    }));
  });

  it('poll parses coil values for coil bindings', async () => {
    const transport = new MockModbusTransport();
    transport.responses.push(new Uint8Array([1, 1, 1, 0x05]));
    const proof = makeProof();
    const bridge = createModbusSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [{ sensorId: 'relay1', unitId: 1, functionCode: 1, address: 0, count: 3, intervalMs: 1000, dataType: 'coil' }],
    });
    await bridge.poll();
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      claims: [expect.objectContaining({ values: [true, false, true] })],
    }));
  });

  it('poll is non-fatal on transport failure', async () => {
    const transport = new MockModbusTransport();
    transport.failSend = true;
    const bridge = createModbusSensorBridge({
      runtime: makeRuntime(),
      transport,
      bindings: [{ sensorId: 'temp1', unitId: 1, functionCode: 3, address: 0, count: 1, intervalMs: 1000, dataType: 'register' }],
    });
    await expect(bridge.poll()).resolves.toBeUndefined();
  });

  it('start runs an immediate poll and schedules intervals', async () => {
    jest.useFakeTimers();
    const transport = new MockModbusTransport();
    transport.responses.push(new Uint8Array([1, 3, 2, 0x11, 0x22]));
    transport.responses.push(new Uint8Array([1, 3, 2, 0x33, 0x44]));
    const proof = makeProof();
    const bridge = createModbusSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [{ sensorId: 'temp1', unitId: 1, functionCode: 3, address: 0, count: 1, intervalMs: 1000, dataType: 'register' }],
    });
    const startPromise = bridge.start();
    await jest.advanceTimersByTimeAsync(0);
    await startPromise;
    expect(proof.createProof).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1000);
    expect(proof.createProof).toHaveBeenCalledTimes(2);
    await bridge.stop();
    await jest.advanceTimersByTimeAsync(1000);
    expect(proof.createProof).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});