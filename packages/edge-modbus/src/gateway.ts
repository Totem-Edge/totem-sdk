/**
 * Modbus Edge Gateway — wires a ModbusTransportPort into an EdgeRuntime.
 *
 * Supports Modbus RTU frame format (no MBAP header) to match the Go native binary.
 * The Go binary parses frame[0] as unitId and frame[1] as functionCode, which
 * is correct for RTU but would misparse TCP frames.
 */

import type { EdgeRuntime, EdgeOperationResult } from '@totemsdk/edge';
import type { ModbusTransportPort, ModbusMessage } from './transport.js';

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

// ── RTU frame builders (no MBAP header — matches Go binary) ──────────────

function buildReadFrame(unitId: number, fc: number, address: number, count: number): Uint8Array {
  const buf = new Uint8Array(8);
  buf[0] = unitId;
  buf[1] = fc;
  new DataView(buf.buffer).setUint16(2, address, false);
  new DataView(buf.buffer).setUint16(4, count, false);
  // CRC placeholder (bytes 6-7) — Go library handles CRC internally
  buf[6] = 0; buf[7] = 0;
  return buf;
}

function buildWriteSingleFrame(unitId: number, fc: number, address: number, value: number): Uint8Array {
  const buf = new Uint8Array(8);
  buf[0] = unitId;
  buf[1] = fc;
  new DataView(buf.buffer).setUint16(2, address, false);
  new DataView(buf.buffer).setUint16(4, value, false);
  buf[6] = 0; buf[7] = 0;
  return buf;
}

function buildWriteMultipleCoilsFrame(unitId: number, address: number, values: boolean[]): Uint8Array {
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

function checkException(response: Uint8Array): void {
  if (response.length < 2) return;
  const fc = response[1];
  if (fc & 0x80) {
    const exceptionCode = response.length >= 3 ? response[2] : 0;
    throw new Error(`Modbus exception: function=${fc & 0x7F} code=${exceptionCode}`);
  }
}

function parseBitResponse(response: Uint8Array, count: number): boolean[] {
  checkException(response);
  const values: boolean[] = [];
  for (let i = 0; i < count; i++) {
    const byte = response[3 + Math.floor(i / 8)] ?? 0;
    values.push(((byte >> (i % 8)) & 1) === 1);
  }
  return values;
}

function parseRegisterResponse(response: Uint8Array, count: number): number[] {
  checkException(response);
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
    checkException(response);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function writeMultipleCoilsImpl(
  transport: ModbusTransportPort,
  unitId: number, address: number, values: boolean[],
): Promise<EdgeOperationResult<void>> {
  try {
    const request = buildWriteMultipleCoilsFrame(unitId, address, values);
    const response = await transport.sendFrame(request);
    checkException(response);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function writeMultipleRegistersImpl(
  transport: ModbusTransportPort,
  unitId: number, address: number, values: number[],
): Promise<EdgeOperationResult<void>> {
  try {
    const request = buildWriteMultipleRegistersFrame(unitId, address, values);
    const response = await transport.sendFrame(request);
    checkException(response);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
