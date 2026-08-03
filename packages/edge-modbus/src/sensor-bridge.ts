/**
 * Modbus Sensor Bridge — maps Modbus register reads to Edge proof inputs.
 *
 * Uses RTU frame format (no MBAP header) to match the Go native binary.
 */

import type { EdgeRuntime } from '@totemsdk/edge';
import type { ModbusTransportPort, ModbusMessage } from './transport.js';
import type { ModbusGateway } from './gateway.js';

export interface ModbusSensorBinding {
  sensorId: string;
  unitId: number;
  functionCode: number;
  address: number;
  count: number;
  intervalMs: number;
  dataType: 'coil' | 'register' | 'input';
  unit?: string;
}

export interface ModbusSensorBridgeConfig {
  runtime: EdgeRuntime;
  transport: ModbusTransportPort;
  gateway?: ModbusGateway;
  bindings: ModbusSensorBinding[];
}

export interface ModbusSensorBridge {
  start(): Promise<void>;
  stop(): Promise<void>;
  poll(): Promise<void>;
}

export function createModbusSensorBridge(config: ModbusSensorBridgeConfig): ModbusSensorBridge {
  const timers: ReturnType<typeof setInterval>[] = [];
  let running = false;

  async function pollBinding(binding: ModbusSensorBinding): Promise<void> {
    try {
      let values: unknown;
      const frame = buildReadFrame(binding.unitId, binding.functionCode, binding.address, binding.count);
      const response = await config.transport.sendFrame(frame);

      if (binding.functionCode === 1 || binding.functionCode === 2) {
        values = parseCoils(response, binding.count);
      } else if (binding.functionCode === 3 || binding.functionCode === 4) {
        values = parseRegisters(response, binding.count);
      }

      if (config.runtime.ports.proof) {
        await config.runtime.ports.proof.createProof({
          subject: `sensor:${binding.sensorId}`,
          claims: [{
            sensorId: binding.sensorId,
            unitId: binding.unitId,
            address: binding.address,
            values,
            unit: binding.unit,
            timestamp: Date.now(),
          }],
        });
      }
    } catch {
      // Poll failures are non-fatal — next cycle retries
    }
  }

  return {
    async start(): Promise<void> {
      if (running) return;
      for (const binding of config.bindings) {
        await pollBinding(binding);
        timers.push(setInterval(() => pollBinding(binding), binding.intervalMs));
      }
      running = true;
    },

    async stop(): Promise<void> {
      for (const t of timers) clearInterval(t);
      timers.length = 0;
      running = false;
    },

    async poll(): Promise<void> {
      for (const binding of config.bindings) {
        await pollBinding(binding);
      }
    },
  };
}

// ── RTU frame builder (no MBAP header — matches Go binary) ────────────────

function buildReadFrame(unitId: number, fc: number, address: number, count: number): Uint8Array {
  const buf = new Uint8Array(8);
  buf[0] = unitId;
  buf[1] = fc;
  new DataView(buf.buffer).setUint16(2, address, false);
  new DataView(buf.buffer).setUint16(4, count, false);
  buf[6] = 0; buf[7] = 0;
  return buf;
}

// ── Response parsers (RTU format — no MBAP header) ────────────────────────

function parseCoils(response: Uint8Array, count: number): boolean[] {
  const result: boolean[] = [];
  for (let i = 0; i < count; i++) {
    const byte = response[3 + Math.floor(i / 8)] ?? 0;
    result.push(((byte >> (i % 8)) & 1) === 1);
  }
  return result;
}

function parseRegisters(response: Uint8Array, count: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    result.push(new DataView(response.buffer, response.byteOffset + 3 + i * 2, 2).getUint16(0, false));
  }
  return result;
}
