import { createCanGateway } from '../gateway.js';
import { createCanSensorBridge } from '../sensor-bridge.js';
import { NativeCanTransport } from '../native-transport.js';
import { createServer } from 'node:net';
import type { AddressInfo, Socket } from 'node:net';
import type { CanTransportPort, CanFrame } from '../transport.js';
import type { EdgeRuntime } from '@totemsdk/edge';

class MockCanTransport implements CanTransportPort {
  opens: string[] = [];
  closeCalls = 0;
  sent: Array<{ id: number; data: Uint8Array; isExtended: boolean }> = [];
  failOpen = false;
  failSend = false;
  frameHandlers: Array<(frame: CanFrame) => void> = [];
  errorHandlers: Array<(err: Error) => void> = [];

  async open(interfaceName: string) { this.opens.push(interfaceName); if (this.failOpen) throw new Error('open failed'); }
  async close() { this.closeCalls++; }
  async send(id: number, data: Uint8Array, isExtended: boolean) { if (this.failSend) throw new Error('send failed'); this.sent.push({ id, data, isExtended }); }
  onFrame(handler: (frame: CanFrame) => void) { this.frameHandlers.push(handler); return () => { this.frameHandlers = this.frameHandlers.filter(h => h !== handler); }; }
  onError(handler: (err: Error) => void) { this.errorHandlers.push(handler); return () => { this.errorHandlers = this.errorHandlers.filter(h => h !== handler); }; }
  emitFrame(frame: CanFrame) { for (const h of this.frameHandlers) h(frame); }
  emitError(err: Error) { for (const h of this.errorHandlers) h(err); }
}

function makeRuntime(proof?: { createProof: jest.Mock }) {
  return { deviceId: 'd1', capabilities: {}, ports: { proof } } as unknown as EdgeRuntime;
}

function makeProof() {
  return { createProof: jest.fn(async () => ({ ok: true, data: { proofId: 'p1', proof: {} } })) };
}

const RPM_SIGNAL = {
  name: 'rpm',
  canId: 0x123,
  isExtended: false,
  startBit: 0,
  length: 16,
  isSigned: false,
  isBigEndian: false,
  scale: 0.5,
  offset: 0,
  unit: 'rpm',
};

describe('edge-can gateway', () => {
  it('start opens the interface and reports running status, stop closes', async () => {
    const transport = new MockCanTransport();
    const gw = createCanGateway({ runtime: makeRuntime(), transport, interfaceName: 'can0' });
    expect(gw.status).toBe('stopped');
    await gw.start();
    expect(transport.opens).toEqual(['can0']);
    expect(gw.status).toBe('running');
    await gw.stop();
    expect(transport.closeCalls).toBe(1);
    expect(gw.status).toBe('stopped');
  });

  it('start is a no-op when already running', async () => {
    const transport = new MockCanTransport();
    const gw = createCanGateway({ runtime: makeRuntime(), transport, interfaceName: 'can0' });
    await gw.start();
    await gw.start();
    expect(transport.opens).toHaveLength(1);
  });

  it('start propagates open failures', async () => {
    const transport = new MockCanTransport();
    transport.failOpen = true;
    const gw = createCanGateway({ runtime: makeRuntime(), transport, interfaceName: 'can0' });
    await expect(gw.start()).rejects.toThrow('open failed');
  });

  it('send delegates to the transport', async () => {
    const transport = new MockCanTransport();
    const gw = createCanGateway({ runtime: makeRuntime(), transport, interfaceName: 'can0' });
    await gw.send(0x100, new Uint8Array([1, 2, 3]), true);
    expect(transport.sent).toEqual([{ id: 0x100, data: new Uint8Array([1, 2, 3]), isExtended: true }]);
  });

  it.each([
    [0x800, false], [-1, false], [0x20000000, true], [1.5, false],
  ])('rejects invalid CAN ID %s', async (id, extended) => {
    const transport = new MockCanTransport();
    const gw = createCanGateway({ runtime: makeRuntime(), transport, interfaceName: 'can0' });
    await expect(gw.send(id as number, new Uint8Array([1]), extended as boolean)).rejects.toThrow(/CAN ID/);
    expect(transport.sent).toHaveLength(0);
  });

  it('rejects payloads longer than 8 bytes', async () => {
    const transport = new MockCanTransport();
    const gw = createCanGateway({ runtime: makeRuntime(), transport, interfaceName: 'can0' });
    await expect(gw.send(0x100, new Uint8Array(9), false)).rejects.toThrow(/0-8 bytes/);
    expect(transport.sent).toHaveLength(0);
  });

  it('ignores malformed inbound frames', async () => {
    const transport = new MockCanTransport();
    const proof = makeProof();
    const gw = createCanGateway({ runtime: makeRuntime(proof), transport, interfaceName: 'can0', signals: [RPM_SIGNAL] });
    await gw.start();
    transport.emitFrame({ id: 0x123, isExtended: false, isRtr: false, dlc: 9, data: new Uint8Array(9), receivedAt: 1 });
    transport.emitFrame({ id: 0x123, isExtended: false, isRtr: false, dlc: 2, data: new Uint8Array([1]), receivedAt: 2 });
    transport.emitFrame({ id: 0x800, isExtended: false, isRtr: false, dlc: 1, data: new Uint8Array([1]), receivedAt: 3 });
    expect(proof.createProof).not.toHaveBeenCalled();
    await gw.stop();
  });

  it('decodes little-endian signals and emits a proof for matching frames', async () => {
    const transport = new MockCanTransport();
    const proof = makeProof();
    const gw = createCanGateway({ runtime: makeRuntime(proof), transport, interfaceName: 'can0', signals: [RPM_SIGNAL] });
    await gw.start();
    transport.emitFrame({ id: 0x123, isExtended: false, isRtr: false, dlc: 2, data: new Uint8Array([0x05, 0x00]), receivedAt: 1000 });
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'can:can0',
      claims: [expect.objectContaining({ canId: 0x123, signals: [{ name: 'rpm', value: 2.5, unit: 'rpm', raw: new Uint8Array([0x05, 0x00]) }] })],
    }));
    await gw.stop();
  });

  it('decodes big-endian (Motorola) signals from the DBC MSB start bit', async () => {
    const transport = new MockCanTransport();
    const proof = makeProof();
    const gw = createCanGateway({
      runtime: makeRuntime(proof),
      transport,
      interfaceName: 'can0',
      signals: [{ ...RPM_SIGNAL, isBigEndian: true, scale: 1, startBit: 7 }],
    });
    await gw.start();
    transport.emitFrame({ id: 0x123, isExtended: false, isRtr: false, dlc: 2, data: new Uint8Array([0x01, 0x02]), receivedAt: 1000 });
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      claims: [expect.objectContaining({ signals: [{ name: 'rpm', value: 258, unit: 'rpm', raw: new Uint8Array([0x01, 0x02]) }] })],
    }));
    await gw.stop();
  });

  it('decodes a Motorola signal that crosses a byte boundary', async () => {
    const transport = new MockCanTransport();
    const proof = makeProof();
    const gw = createCanGateway({
      runtime: makeRuntime(proof),
      transport,
      interfaceName: 'can0',
      signals: [{ ...RPM_SIGNAL, isBigEndian: true, scale: 1, startBit: 7, length: 12 }],
    });
    await gw.start();
    transport.emitFrame({ id: 0x123, isExtended: false, isRtr: false, dlc: 2, data: new Uint8Array([0xab, 0xcd]), receivedAt: 1000 });
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      claims: [expect.objectContaining({ signals: [expect.objectContaining({ value: 0xabc })] })],
    }));
    await gw.stop();
  });

  it('sign-extends signed signals', async () => {
    const transport = new MockCanTransport();
    const proof = makeProof();
    const gw = createCanGateway({
      runtime: makeRuntime(proof),
      transport,
      interfaceName: 'can0',
      signals: [{ ...RPM_SIGNAL, isSigned: true, scale: 1 }],
    });
    await gw.start();
    transport.emitFrame({ id: 0x123, isExtended: false, isRtr: false, dlc: 2, data: new Uint8Array([0xFF, 0xFF]), receivedAt: 1000 });
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      claims: [expect.objectContaining({ signals: [{ name: 'rpm', value: -1, unit: 'rpm', raw: new Uint8Array([0xFF, 0xFF]) }] })],
    }));
    await gw.stop();
  });

  it('ignores frames that match no signal definition', async () => {
    const transport = new MockCanTransport();
    const proof = makeProof();
    const gw = createCanGateway({ runtime: makeRuntime(proof), transport, interfaceName: 'can0', signals: [RPM_SIGNAL] });
    await gw.start();
    transport.emitFrame({ id: 0xFFF, isExtended: false, isRtr: false, dlc: 0, data: new Uint8Array(), receivedAt: 1000 });
    expect(proof.createProof).not.toHaveBeenCalled();
    await gw.stop();
  });

  it('applies acceptance filters before decoding', async () => {
    const transport = new MockCanTransport();
    const proof = makeProof();
    const gw = createCanGateway({
      runtime: makeRuntime(proof), transport, interfaceName: 'can0', signals: [RPM_SIGNAL],
      filters: [{ id: 0x123 }],
    });
    await gw.start();
    transport.emitFrame({ id: 0x456, isExtended: false, isRtr: false, dlc: 2, data: new Uint8Array([0x05, 0x00]), receivedAt: 1 });
    expect(proof.createProof).not.toHaveBeenCalled();
    transport.emitFrame({ id: 0x123, isExtended: false, isRtr: false, dlc: 2, data: new Uint8Array([0x05, 0x00]), receivedAt: 2 });
    expect(proof.createProof).toHaveBeenCalledTimes(1);
    await gw.stop();
  });

  it('matches masked filters and respects the extended flag', async () => {
    const transport = new MockCanTransport();
    const proof = makeProof();
    const gw = createCanGateway({
      runtime: makeRuntime(proof), transport, interfaceName: 'can0', signals: [RPM_SIGNAL],
      filters: [{ id: 0x120, mask: 0x7f0, isExtended: false }],
    });
    await gw.start();
    transport.emitFrame({ id: 0x456, isExtended: false, isRtr: false, dlc: 2, data: new Uint8Array([1, 0]), receivedAt: 1 });
    transport.emitFrame({ id: 0x123, isExtended: true, isRtr: false, dlc: 2, data: new Uint8Array([1, 0]), receivedAt: 2 });
    expect(proof.createProof).not.toHaveBeenCalled();
    transport.emitFrame({ id: 0x123, isExtended: false, isRtr: false, dlc: 2, data: new Uint8Array([1, 0]), receivedAt: 3 });
    expect(proof.createProof).toHaveBeenCalledTimes(1);
    await gw.stop();
  });

  it('does not cross-match classic and extended ID namespaces', async () => {
    const transport = new MockCanTransport();
    const proof = makeProof();
    const gw = createCanGateway({
      runtime: makeRuntime(proof), transport, interfaceName: 'can0',
      signals: [RPM_SIGNAL, { ...RPM_SIGNAL, canId: 0x1abcdef, isExtended: true }],
      filters: [{ id: 0x123 }, { id: 0x1abcdef }],
    });
    await gw.start();
    // Same numeric ID as the classic filter, but in the extended namespace.
    transport.emitFrame({ id: 0x123, isExtended: true, isRtr: false, dlc: 2, data: new Uint8Array([1, 0]), receivedAt: 1 });
    expect(proof.createProof).not.toHaveBeenCalled();
    transport.emitFrame({ id: 0x1abcdef, isExtended: true, isRtr: false, dlc: 2, data: new Uint8Array([2, 0]), receivedAt: 2 });
    expect(proof.createProof).toHaveBeenCalledTimes(1);
    await gw.stop();
  });

  it('ignores remote transmission request frames', async () => {
    const transport = new MockCanTransport();
    const proof = makeProof();
    const gw = createCanGateway({ runtime: makeRuntime(proof), transport, interfaceName: 'can0', signals: [RPM_SIGNAL] });
    await gw.start();
    transport.emitFrame({ id: 0x123, isExtended: false, isRtr: true, dlc: 2, data: new Uint8Array([1, 2]), receivedAt: 1 });
    expect(proof.createProof).not.toHaveBeenCalled();
    await gw.stop();
  });

  it('rejects invalid signal definitions and filters at creation', () => {
    const transport = new MockCanTransport();
    const runtime = makeRuntime();
    expect(() => createCanGateway({
      runtime, transport, interfaceName: 'can0', signals: [{ ...RPM_SIGNAL, canId: 0x800 }],
    })).toThrow(/CAN ID/);
    expect(() => createCanGateway({
      runtime, transport, interfaceName: 'can0', signals: [{ ...RPM_SIGNAL, length: 0 }],
    })).toThrow(/length/);
    expect(() => createCanGateway({
      runtime, transport, interfaceName: 'can0', filters: [{ id: 0x800, isExtended: false }],
    })).toThrow(/filter ID/);
  });

  it('sign-extends a 32-bit signal', async () => {
    const transport = new MockCanTransport();
    const proof = makeProof();
    const gw = createCanGateway({
      runtime: makeRuntime(proof), transport, interfaceName: 'can0',
      signals: [{ ...RPM_SIGNAL, isSigned: true, length: 32, scale: 1 }],
    });
    await gw.start();
    transport.emitFrame({ id: 0x123, isExtended: false, isRtr: false, dlc: 4, data: new Uint8Array([0xff, 0xff, 0xff, 0xff]), receivedAt: 1 });
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      claims: [expect.objectContaining({ signals: [expect.objectContaining({ value: -1 })] })],
    }));
    await gw.stop();
  });

  it('returns to running after a valid frame follows a transport error', async () => {
    const transport = new MockCanTransport();
    const proof = makeProof();
    const gw = createCanGateway({ runtime: makeRuntime(proof), transport, interfaceName: 'can0', signals: [RPM_SIGNAL] });
    await gw.start();
    transport.emitError(new Error('bus-off'));
    expect(gw.status).toBe('error');
    transport.emitFrame({ id: 0x123, isExtended: false, isRtr: false, dlc: 2, data: new Uint8Array([1, 0]), receivedAt: 1 });
    expect(gw.status).toBe('running');
    await gw.stop();
  });

  it('transport errors flip status to error', async () => {
    const transport = new MockCanTransport();
    const gw = createCanGateway({ runtime: makeRuntime(), transport, interfaceName: 'can0' });
    await gw.start();
    transport.emitError(new Error('adapter reset'));
    expect(gw.status).toBe('error');
    await gw.stop();
  });
});

describe('edge-can sensor bridge', () => {
  it('start subscribes and emits proofs for matching frames', async () => {
    const transport = new MockCanTransport();
    const proof = makeProof();
    const bridge = createCanSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [{ sensorId: 'sensor1', canId: 0x123, isExtended: false, signalName: 'rpm', dataType: 'engine' }],
    });
    await bridge.start();
    transport.emitFrame({ id: 0x123, isExtended: false, isRtr: false, dlc: 2, data: new Uint8Array([10, 0]), receivedAt: 500 });
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'sensor:sensor1',
      claims: [expect.objectContaining({ sensorId: 'sensor1', canId: 0x123, signalName: 'rpm', data: [10, 0], timestamp: 500 })],
    }));
    await bridge.stop();
  });

  it('ignores frames for other CAN IDs', async () => {
    const transport = new MockCanTransport();
    const proof = makeProof();
    const bridge = createCanSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [{ sensorId: 'sensor1', canId: 0x123, isExtended: false, signalName: 'rpm' }],
    });
    await bridge.start();
    transport.emitFrame({ id: 0x999, isExtended: false, isRtr: false, dlc: 1, data: new Uint8Array([1]), receivedAt: 500 });
    expect(proof.createProof).not.toHaveBeenCalled();
    await bridge.stop();
  });

  it('stop unsubscribes from frame events', async () => {
    const transport = new MockCanTransport();
    const proof = makeProof();
    const bridge = createCanSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [{ sensorId: 'sensor1', canId: 0x123, isExtended: false, signalName: 'rpm' }],
    });
    await bridge.start();
    await bridge.stop();
    transport.emitFrame({ id: 0x123, isExtended: false, isRtr: false, dlc: 1, data: new Uint8Array([1]), receivedAt: 500 });
    expect(proof.createProof).not.toHaveBeenCalled();
  });
});
describe('native CAN transport', () => {
  it('decodes frame pushes, surfaces sidecar errors and closes without a spurious error', async () => {
    const requests: Array<{ id: string; type: string }> = [];
    let peer: Socket | undefined;
    const server = createServer((socket) => {
      peer = socket;
      let buffer = '';
      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        let newline: number;
        while ((newline = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          const request = JSON.parse(line) as { id: string; type: string };
          requests.push(request);
          if (request.type === 'open' || request.type === 'close') {
            socket.write(JSON.stringify({ id: request.id, ok: true }) + '\n');
          } else if (request.type === 'send') {
            socket.write(JSON.stringify({ type: 'error', code: 'bus-off', error: 'bus off' }) + '\n');
            socket.write(JSON.stringify({ id: request.id, ok: true }) + '\n');
          }
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;

    const transport = new NativeCanTransport({ port, connectTimeoutMs: 1000, requestTimeoutMs: 1000 });
    const frames: CanFrame[] = [];
    const errors: Error[] = [];
    transport.onFrame((frame) => frames.push(frame));
    transport.onError((error) => errors.push(error));

    await transport.open('vcan0');
    const received = new Promise<CanFrame>((resolve) => transport.onFrame(resolve));
    peer!.write(JSON.stringify({ type: 'frame', id: 0x123, isExtended: false, isRtr: false, dlc: 2, data: '0500', timestamp: 42 }) + '\n');
    expect(await received).toEqual({
      id: 0x123, isExtended: false, isRtr: false, dlc: 2, data: new Uint8Array([0x05, 0x00]), receivedAt: 42,
    });

    await transport.send(0x100, new Uint8Array([1]), false);
    expect(errors.map((error) => error.message)).toContain('NativeCanTransport: bus-off: bus off');

    await transport.close();
    const errorsAtClose = errors.length;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(errors.length).toBe(errorsAtClose);
    expect(requests.map((request) => request.type)).toEqual(['open', 'send', 'close']);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
