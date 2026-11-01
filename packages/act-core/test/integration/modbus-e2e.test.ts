/**
 * RFC-010 P6 — real-system E2E over a loopback Modbus/TCP emulator.
 *
 * A `net`-based Modbus/TCP emulator (MBAP header + FC6 write-single-register)
 * receives the actuation from a governed industrial action. This exercises a
 * real socket + protocol round-trip; the production transport is the
 * `@totemsdk/edge-modbus` Go sidecar, which speaks the same frames.
 */

import net from 'node:net';

import { toEdgeActionDefinition } from '../../src/edge-adapter.js';
import type { IndustrialActionDefinition, PreparedDeviceOp } from '../../src/edge-adapter.js';
import type { ActionSchema } from '../../src/types.js';

const SCHEMA: ActionSchema = {
  parameters: [{ name: 'setpoint', type: 'number', required: true }],
  context: [{ name: 'zoneId', type: 'string', required: true }],
};

interface RegisterWrite {
  unitId: number;
  address: number;
  value: number;
}

/** Start an MBAP/FC6 emulator; returns the port and captured writes. */
function startModbusEmulator(): Promise<{
  port: number;
  writes: RegisterWrite[];
  close: () => Promise<void>;
}> {
  const writes: RegisterWrite[] = [];
  const server = net.createServer((socket) => {
    socket.on('data', (frame) => {
      // MBAP: [txId(2) proto(2) len(2) unit(1)] then [fc(1) addr(2) value(2)]
      const unitId = frame.readUInt8(6);
      const functionCode = frame.readUInt8(7);
      if (functionCode === 0x06) {
        writes.push({
          unitId,
          address: frame.readUInt16BE(8),
          value: frame.readUInt16BE(10),
        });
      }
      socket.write(frame); // FC6 echoes the request
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      resolve({
        port,
        writes,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}

/** Send one FC6 write-single-register over a fresh TCP connection. */
function writeRegister(port: number, unitId: number, address: number, value: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const frame = Buffer.alloc(12);
    frame.writeUInt16BE(0x0001, 0); // transaction id
    frame.writeUInt16BE(0x0000, 2); // protocol id
    frame.writeUInt16BE(0x0006, 4); // length
    frame.writeUInt8(unitId, 6);
    frame.writeUInt8(0x06, 7);
    frame.writeUInt16BE(address, 8);
    frame.writeUInt16BE(value, 10);

    const socket = net.connect(port, '127.0.0.1', () => socket.write(frame));
    socket.once('data', (response) => {
      socket.end();
      resolve(new Uint8Array(response));
    });
    socket.once('error', reject);
    socket.setTimeout(2000, () => {
      socket.destroy();
      reject(new Error('modbus emulator timeout'));
    });
  });
}

function makeDefinition(port: number): IndustrialActionDefinition {
  return {
    kind: 'industrial:temp.set',
    description: 'Set temperature setpoint over Modbus',
    schema: SCHEMA,
    capability: 'industrial:action',
    effect: 'write',
    policy: { failureMode: 'fail-safe', timeoutMs: 2000 },
    safeState: async () => writeRegister(port, 1, 0x0000, 0).then(() => ({ ok: true })),
    async prepare(params) {
      return { resourceId: 'HVAC-03', command: { setpoint: params.setpoint } };
    },
    deriveEffects: () => ({ spends: [] }),
    actuate: async (op: PreparedDeviceOp) => {
      const setpoint = (op.command as { setpoint: number }).setpoint;
      const value = Math.round(setpoint * 10); // 0.1 °C resolution
      const response = await writeRegister(port, 1, 0x0000, value);
      return { ok: response.length === 12, data: { register: value } };
    },
  };
}

describe('Modbus/TCP emulator E2E (RFC-010 P6)', () => {
  it('drives a governed industrial action to a real device emulator', async () => {
    const emulator = await startModbusEmulator();
    try {
      const edgeDef = toEdgeActionDefinition(makeDefinition(emulator.port));
      const prepared = (await edgeDef.prepare({
        action: 'industrial:temp.set',
        subject: 'HVAC-03',
        payload: { setpoint: 22.5 },
        context: { zoneId: 'HVAC-03' },
      })) as PreparedDeviceOp;

      const result = await edgeDef.execute(prepared);
      expect(result.ok).toBe(true);
      expect(emulator.writes).toEqual([{ unitId: 1, address: 0x0000, value: 225 }]);
    } finally {
      await emulator.close();
    }
  });

  it('commands safe state when the device write fails', async () => {
    const emulator = await startModbusEmulator();
    try {
      const def = makeDefinition(emulator.port);
      const failing: IndustrialActionDefinition = {
        ...def,
        actuate: async () => ({ ok: false, error: 'device refused', errorCode: 'EXECUTION_FAILED' }),
      };
      const edgeDef = toEdgeActionDefinition(failing);
      const prepared = (await edgeDef.prepare({
        action: 'industrial:temp.set',
        subject: 'HVAC-03',
        payload: { setpoint: 22.5 },
        context: { zoneId: 'HVAC-03' },
      })) as PreparedDeviceOp;

      const result = await edgeDef.execute(prepared);
      expect(result).toMatchObject({ ok: false, outcome: 'safe-stated', safeStateApplied: true });
      expect(emulator.writes).toEqual([{ unitId: 1, address: 0x0000, value: 0 }]);
    } finally {
      await emulator.close();
    }
  });
});
