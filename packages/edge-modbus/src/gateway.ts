/**
 * Modbus Edge Gateway — wires a ModbusTransportPort into an EdgeRuntime.
 */

import type { EdgeRuntime, EdgeOperationResult } from '@totemsdk/edge';
import type { ModbusTransportPort, ModbusMessage } from './transport.js';

export interface ModbusGatewayConfig {
  runtime: EdgeRuntime;
  transport: ModbusTransportPort;
  /** Map unit IDs to sensor/device identifiers. */
  unitMap?: Record<number, string>;
}

export interface ModbusGateway {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly status: 'stopped' | 'running' | 'error';
  /** Read coils (function code 1). */
  readCoils(unitId: number, address: number, count: number): Promise<EdgeOperationResult<{ values: boolean[] }>>;
  /** Read holding registers (function code 3). */
  readRegisters(unitId: number, address: number, count: number): Promise<EdgeOperationResult<{ values: number[] }>>;
}

export function createModbusGateway(config: ModbusGatewayConfig): ModbusGateway {
  let status: 'stopped' | 'running' | 'error' = 'stopped';
  let unsubFrame: (() => void) | undefined;
  let unsubError: (() => void) | undefined;

  return {
    get status() { return status; },

    async start(): Promise<void> {
      if (status === 'running') return;
      await config.transport.connect();
      unsubFrame = config.transport.onFrame((frame) => {
        // Frames are dispatched by the sensor bridge
      });
      unsubError = config.transport.onError(() => {
        status = 'error';
      });
      status = 'running';
    },

    async stop(): Promise<void> {
      unsubFrame?.();
      unsubError?.();
      await config.transport.disconnect();
      status = 'stopped';
    },

    async readCoils(unitId, address, count) {
      try {
        const request = buildModbusFrame(unitId, 1, address, count);
        const response = await config.transport.sendFrame(request);
        const values = parseCoilResponse(response, count);
        return { ok: true, data: { values } };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    },

    async readRegisters(unitId, address, count) {
      try {
        const request = buildModbusFrame(unitId, 3, address, count);
        const response = await config.transport.sendFrame(request);
        const values = parseRegisterResponse(response, count);
        return { ok: true, data: { values } };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    },
  };
}

function buildModbusFrame(unitId: number, functionCode: number, address: number, count: number): Uint8Array {
  const buf = new Uint8Array(8);
  buf[0] = 0; buf[1] = 0; // transaction ID
  buf[2] = 0; buf[3] = 0; // protocol ID
  buf[4] = 0; buf[5] = 2; // length
  buf[6] = unitId;
  buf[7] = functionCode;
  const addr = new Uint8Array(2);
  new DataView(addr.buffer).setUint16(0, address, false);
  const cnt = new Uint8Array(2);
  new DataView(cnt.buffer).setUint16(0, count, false);
  const result = new Uint8Array(8 + 4);
  result.set(buf); result.set(addr, 8); result.set(cnt, 10);
  return result;
}

function parseCoilResponse(response: Uint8Array, count: number): boolean[] {
  const values: boolean[] = [];
  for (let i = 0; i < count; i++) {
    const byte = response[9 + Math.floor(i / 8)] ?? 0;
    values.push(((byte >> (i % 8)) & 1) === 1);
  }
  return values;
}

function parseRegisterResponse(response: Uint8Array, count: number): number[] {
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const offset = 9 + i * 2;
    values.push(new DataView(response.buffer, response.byteOffset + offset, 2).getUint16(0, false));
  }
  return values;
}
