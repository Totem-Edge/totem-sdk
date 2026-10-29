/**
 * Modbus Edge Gateway — wires a ModbusTransportPort into an EdgeRuntime.
 *
 * Uses a unit-prefixed PDU (no CRC or MBAP header) at the transport boundary.
 * The binding owns TCP transaction framing or RTU CRC validation.
 */

import type { EdgeRuntime, EdgeOperationResult } from '@totemsdk/edge';
import type { ModbusTransportPort } from './transport.js';

export interface ModbusGatewayConfig {
  runtime: EdgeRuntime;
  transport: ModbusTransportPort;
  unitMap?: Record<number, string>;
}

export interface ModbusGateway {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly status: 'stopped' | 'running' | 'error';
  readCoils(unitId: number, address: number, count: number): Promise<EdgeOperationResult<{ values: boolean[] }>>;
  readDiscreteInputs(unitId: number, address: number, count: number): Promise<EdgeOperationResult<{ values: boolean[] }>>;
  readHoldingRegisters(unitId: number, address: number, count: number): Promise<EdgeOperationResult<{ values: number[] }>>;
  readInputRegisters(unitId: number, address: number, count: number): Promise<EdgeOperationResult<{ values: number[] }>>;
  writeSingleCoil(unitId: number, address: number, value: boolean): Promise<EdgeOperationResult<void>>;
  writeSingleRegister(unitId: number, address: number, value: number): Promise<EdgeOperationResult<void>>;
  writeMultipleCoils(unitId: number, address: number, values: boolean[]): Promise<EdgeOperationResult<void>>;
  writeMultipleRegisters(unitId: number, address: number, values: number[]): Promise<EdgeOperationResult<void>>;
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
      unsubFrame = config.transport.onFrame((_frame) => {
        // Unsolicited frames are not expected in Modbus request/response model
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
      return readBits(config.transport, unitId, 1, address, count);
    },

    async readDiscreteInputs(unitId, address, count) {
      return readBits(config.transport, unitId, 2, address, count);
    },

    async readHoldingRegisters(unitId, address, count) {
      return readRegisters(config.transport, unitId, 3, address, count);
    },

    async readInputRegisters(unitId, address, count) {
      return readRegisters(config.transport, unitId, 4, address, count);
    },

    async writeSingleCoil(unitId, address, value) {
      if (typeof value !== 'boolean') return { ok: false, error: 'Coil value must be boolean', errorCode: 'MODBUS_INVALID_REQUEST' };
      return writeSingle(config.transport, unitId, 5, address, value ? 0xFF00 : 0x0000);
    },

    async writeSingleRegister(unitId, address, value) {
      return writeSingle(config.transport, unitId, 6, address, value);
    },

    async writeMultipleCoils(unitId, address, values) {
      return writeMultipleCoilsImpl(config.transport, unitId, address, values);
    },

    async writeMultipleRegisters(unitId, address, values) {
      return writeMultipleRegistersImpl(config.transport, unitId, address, values);
    },
  };
}

// ── Unit-prefixed PDU builders (no CRC or MBAP header) ───────────────────

class ModbusRequestError extends Error {}
class ModbusExceptionError extends Error {}

function validateRange(unitId: number, address: number, count: number, maximum: number): void {
  if (!Number.isInteger(unitId) || unitId < 1 || unitId > 247 ||
      !Number.isInteger(address) || address < 0 || address > 0xffff ||
      !Number.isInteger(count) || count < 1 || count > maximum || address + count > 0x10000) {
    throw new ModbusRequestError('Invalid Modbus unit, address or quantity');
  }
}

function validateRegister(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new ModbusRequestError('Register value must be an unsigned 16-bit integer');
  }
}

function buildReadFrame(unitId: number, fc: number, address: number, count: number): Uint8Array {
  validateRange(unitId, address, count, fc <= 2 ? 2000 : 125);
  const buf = new Uint8Array(6);
  buf[0] = unitId;
  buf[1] = fc;
  new DataView(buf.buffer).setUint16(2, address, false);
  new DataView(buf.buffer).setUint16(4, count, false);
  return buf;
}

function buildWriteSingleFrame(unitId: number, fc: number, address: number, value: number): Uint8Array {
  validateRange(unitId, address, 1, 1);
  validateRegister(value);
  const buf = new Uint8Array(6);
  buf[0] = unitId;
  buf[1] = fc;
  new DataView(buf.buffer).setUint16(2, address, false);
  new DataView(buf.buffer).setUint16(4, value, false);
  return buf;
}

function buildWriteMultipleCoilsFrame(unitId: number, address: number, values: boolean[]): Uint8Array {
  validateRange(unitId, address, values.length, 1968);
  for (const value of values) {
    if (typeof value !== 'boolean') throw new ModbusRequestError('Coil values must be boolean');
  }
  const byteCount = Math.ceil(values.length / 8);
  const buf = new Uint8Array(7 + byteCount);
  buf[0] = unitId;
  buf[1] = 15; // FC 15
  new DataView(buf.buffer).setUint16(2, address, false);
  new DataView(buf.buffer).setUint16(4, values.length, false);
  buf[6] = byteCount;
  for (let i = 0; i < values.length; i++) {
    if (values[i]) {
      buf[7 + Math.floor(i / 8)] |= (1 << (i % 8));
    }
  }
  return buf;
}

function buildWriteMultipleRegistersFrame(unitId: number, address: number, values: number[]): Uint8Array {
  validateRange(unitId, address, values.length, 123);
  for (const value of values) validateRegister(value);
  const byteCount = values.length * 2;
  const buf = new Uint8Array(7 + byteCount);
  buf[0] = unitId;
  buf[1] = 16; // FC 16
  new DataView(buf.buffer).setUint16(2, address, false);
  new DataView(buf.buffer).setUint16(4, values.length, false);
  buf[6] = byteCount;
  for (let i = 0; i < values.length; i++) {
    new DataView(buf.buffer).setUint16(7 + i * 2, values[i], false);
  }
  return buf;
}

// ── Response parsers (RTU format — no MBAP header) ────────────────────────

function checkResponse(response: Uint8Array, unitId: number, expectedFunction: number): void {
  if (response.length < 2 || response[0] !== unitId) throw new Error('Modbus response unit/length mismatch');
  const fc = response[1];
  if (fc === (expectedFunction | 0x80)) {
    if (response.length !== 3 || response[2] === 0) throw new Error('Malformed Modbus exception response');
    throw new ModbusExceptionError(`Modbus exception: function=${expectedFunction} code=${response[2]}`);
  }
  if (fc !== expectedFunction) throw new Error('Modbus response function mismatch');
}

function checkReadLength(response: Uint8Array, byteCount: number): void {
  if (response.length !== 3 + byteCount || response[2] !== byteCount) {
    throw new Error('Modbus response byte count/length mismatch');
  }
}

function checkWriteResponse(response: Uint8Array, request: Uint8Array): void {
  checkResponse(response, request[0], request[1]);
  if (response.length !== 6 || response.some((byte, index) => byte !== request[index])) {
    throw new Error('Modbus write acknowledgement mismatch');
  }
}

function writeFailure(error: unknown): EdgeOperationResult<void> {
  return { ok: false, error: String(error), errorCode: error instanceof ModbusRequestError
    ? 'MODBUS_INVALID_REQUEST' : error instanceof ModbusExceptionError
      ? 'MODBUS_EXCEPTION' : 'MODBUS_WRITE_OUTCOME_UNKNOWN' };
}

function parseBitResponse(response: Uint8Array, count: number): boolean[] {
  checkReadLength(response, Math.ceil(count / 8));
  const values: boolean[] = [];
  for (let i = 0; i < count; i++) {
    const byte = response[3 + Math.floor(i / 8)];
    values.push(((byte >> (i % 8)) & 1) === 1);
  }
  return values;
}

function parseRegisterResponse(response: Uint8Array, count: number): number[] {
  checkReadLength(response, count * 2);
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    values.push(new DataView(response.buffer, response.byteOffset + 3 + i * 2, 2).getUint16(0, false));
  }
  return values;
}

// ── Operation implementations ─────────────────────────────────────────────

async function readBits(
  transport: ModbusTransportPort,
  unitId: number, fc: number, address: number, count: number,
): Promise<EdgeOperationResult<{ values: boolean[] }>> {
  try {
    const request = buildReadFrame(unitId, fc, address, count);
    const response = await transport.sendFrame(request);
    checkResponse(response, unitId, fc);
    return { ok: true, data: { values: parseBitResponse(response, count) } };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function readRegisters(
  transport: ModbusTransportPort,
  unitId: number, fc: number, address: number, count: number,
): Promise<EdgeOperationResult<{ values: number[] }>> {
  try {
    const request = buildReadFrame(unitId, fc, address, count);
    const response = await transport.sendFrame(request);
    checkResponse(response, unitId, fc);
    return { ok: true, data: { values: parseRegisterResponse(response, count) } };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function writeSingle(
  transport: ModbusTransportPort,
  unitId: number, fc: number, address: number, value: number,
): Promise<EdgeOperationResult<void>> {
  try {
    const request = buildWriteSingleFrame(unitId, fc, address, value);
    const response = await transport.sendFrame(request);
    checkWriteResponse(response, request);
    return { ok: true };
  } catch (e) {
    return writeFailure(e);
  }
}

async function writeMultipleCoilsImpl(
  transport: ModbusTransportPort,
  unitId: number, address: number, values: boolean[],
): Promise<EdgeOperationResult<void>> {
  try {
    const request = buildWriteMultipleCoilsFrame(unitId, address, values);
    const response = await transport.sendFrame(request);
    checkWriteResponse(response, request);
    return { ok: true };
  } catch (e) {
    return writeFailure(e);
  }
}

async function writeMultipleRegistersImpl(
  transport: ModbusTransportPort,
  unitId: number, address: number, values: number[],
): Promise<EdgeOperationResult<void>> {
  try {
    const request = buildWriteMultipleRegistersFrame(unitId, address, values);
    const response = await transport.sendFrame(request);
    checkWriteResponse(response, request);
    return { ok: true };
  } catch (e) {
    return writeFailure(e);
  }
}
