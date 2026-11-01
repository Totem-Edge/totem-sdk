/**
 * CAN Bus Edge Gateway — wires a CanTransportPort into an EdgeRuntime.
 *
 * Frames are validated before decoding: classic CAN only (0-8 data bytes),
 * 11-bit or 29-bit arbitration IDs, and DLC matching the payload. Optional
 * filters drop unrelated traffic before signal decoding.
 */

import type { EdgeRuntime } from '@totemsdk/edge';
import type { CanTransportPort, CanFrame, CanSignal } from './transport.js';

export interface CanGatewayConfig {
  runtime: EdgeRuntime;
  transport: CanTransportPort;
  interfaceName: string;
  /** Optional DBC signal definitions for decoding. */
  signals?: CanSignalDef[];
  /** Optional acceptance filters. When set, non-matching frames are ignored. */
  filters?: CanFilter[];
}

export interface CanSignalDef {
  name: string;
  canId: number;
  isExtended: boolean;
  startBit: number;
  length: number;
  isSigned: boolean;
  isBigEndian: boolean;
  scale: number;
  offset: number;
  unit?: string;
}

export interface CanFilter {
  /** Arbitration ID to match. */
  id: number;
  /** Bits to compare (defaults to the full 11-bit or 29-bit ID width). */
  mask?: number;
  /** Restrict matching to classic or extended frames. */
  isExtended?: boolean;
}

export interface CanGateway {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly status: 'stopped' | 'running' | 'error';
  send(id: number, data: Uint8Array, isExtended?: boolean): Promise<void>;
}

function maxId(isExtended: boolean): number {
  return isExtended ? 0x1fffffff : 0x7ff;
}

function assertFrame(id: number, data: Uint8Array, isExtended: boolean): void {
  const max = maxId(isExtended);
  if (!Number.isInteger(id) || id < 0 || id > max) {
    throw new Error(`Invalid ${isExtended ? '29-bit' : '11-bit'} CAN ID: ${id}`);
  }
  if (!(data instanceof Uint8Array) || data.length > 8) {
    throw new Error('CAN data must be 0-8 bytes');
  }
}

function isValidReceivedFrame(frame: CanFrame): boolean {
  return Number.isInteger(frame.id) && frame.id >= 0 && frame.id <= maxId(frame.isExtended) &&
    Number.isInteger(frame.dlc) && frame.dlc >= 0 && frame.dlc <= 8 &&
    frame.data instanceof Uint8Array && frame.data.length === frame.dlc;
}

function assertSignalDef(signal: CanSignalDef): void {
  if (!Number.isInteger(signal.canId) || signal.canId < 0 || signal.canId > maxId(signal.isExtended)) {
    throw new Error(`Invalid CAN ID in signal '${signal.name}': ${signal.canId}`);
  }
  if (!Number.isInteger(signal.startBit) || signal.startBit < 0 || signal.startBit > 63) {
    throw new Error(`Invalid start bit in signal '${signal.name}': ${signal.startBit}`);
  }
  if (!Number.isInteger(signal.length) || signal.length < 1 || signal.length > 64) {
    throw new Error(`Invalid length in signal '${signal.name}': ${signal.length}`);
  }
  if (!Number.isFinite(signal.scale) || !Number.isFinite(signal.offset)) {
    throw new Error(`Non-finite scale/offset in signal '${signal.name}'`);
  }
}

function filterIsExtended(filter: CanFilter): boolean {
  // With no explicit flag, infer the namespace from the ID: 11-bit IDs are
  // classic, wider IDs are extended. Use isExtended to be explicit.
  return filter.isExtended ?? filter.id > 0x7ff;
}

function assertFilter(filter: CanFilter): void {
  const extended = filterIsExtended(filter);
  const max = maxId(extended);
  if (!Number.isInteger(filter.id) || filter.id < 0 || filter.id > max) {
    throw new Error(`Invalid CAN filter ID: ${filter.id}`);
  }
  if (filter.mask !== undefined && (!Number.isInteger(filter.mask) || filter.mask < 0 || filter.mask > max)) {
    throw new Error(`Invalid CAN filter mask: ${filter.mask}`);
  }
}

function matchesFilter(filter: CanFilter, frame: CanFrame): boolean {
  const extended = filterIsExtended(filter);
  if (extended !== frame.isExtended) return false;
  const mask = filter.mask ?? maxId(extended);
  return (frame.id & mask) === (filter.id & mask);
}

export function createCanGateway(config: CanGatewayConfig): CanGateway {
  let status: 'stopped' | 'running' | 'error' = 'stopped';
  let unsubFrame: (() => void) | undefined;
  let unsubError: (() => void) | undefined;

  for (const signal of config.signals ?? []) assertSignalDef(signal);
  for (const filter of config.filters ?? []) assertFilter(filter);

  function decodeSignals(frame: CanFrame): CanSignal[] {
    if (!config.signals) return [];
    return config.signals
      .filter(s => s.canId === frame.id && s.isExtended === frame.isExtended)
      .map(s => {
        const raw = extractBits(frame.data, s.startBit, s.length, s.isBigEndian);
        let value = s.isSigned ? signExtend(raw, s.length) : raw;
        value = value * s.scale + s.offset;
        return { name: s.name, value, unit: s.unit, raw: frame.data };
      });
  }

  function accepts(frame: CanFrame): boolean {
    if (!config.filters || config.filters.length === 0) return true;
    return config.filters.some(filter => matchesFilter(filter, frame));
  }

  return {
    get status() { return status; },

    async start(): Promise<void> {
      if (status === 'running') return;
      await config.transport.open(config.interfaceName);
      unsubFrame = config.transport.onFrame((frame) => {
        if (!isValidReceivedFrame(frame)) return;
        if (frame.isRtr) return;
        if (!accepts(frame)) return;
        // Receiving a valid frame proves the link recovered from a transient error.
        if (status === 'error') status = 'running';
        const signals = decodeSignals(frame);
        if (signals.length > 0 && config.runtime.ports.proof) {
          config.runtime.ports.proof.createProof({
            subject: `can:${config.interfaceName}`,
            claims: [{ canId: frame.id, signals, timestamp: frame.receivedAt }],
          }).catch(() => {});
        }
      });
      unsubError = config.transport.onError(() => { status = 'error'; });
      status = 'running';
    },

    async stop(): Promise<void> {
      unsubFrame?.(); unsubError?.();
      unsubFrame = undefined;
      unsubError = undefined;
      await config.transport.close();
      status = 'stopped';
    },

    async send(id, data, isExtended = false): Promise<void> {
      assertFrame(id, data, isExtended);
      await config.transport.send(id, data, isExtended);
    },
  };
}

function extractBits(data: Uint8Array, startBit: number, length: number, bigEndian: boolean): number {
  let result = 0n;
  if (!bigEndian) {
    for (let i = 0; i < length; i++) {
      const bitIdx = startBit + i;
      const byteIdx = (bitIdx / 8) | 0;
      const bitInByte = bitIdx % 8;
      if (byteIdx < data.length && ((data[byteIdx] >> bitInByte) & 1)) {
        result |= (1n << BigInt(i));
      }
    }
    return Number(result);
  }

  // DBC Motorola numbering: startBit is the most-significant bit position, the
  // signal walks down within a byte and jumps to the next byte's MSB.
  let bitIdx = startBit;
  for (let i = 0; i < length; i++) {
    const byteIdx = (bitIdx / 8) | 0;
    const bitInByte = bitIdx % 8;
    const bit = byteIdx < data.length ? (data[byteIdx] >> bitInByte) & 1 : 0;
    result = (result << 1n) | BigInt(bit);
    bitIdx = bitIdx % 8 === 0 ? bitIdx + 15 : bitIdx - 1;
  }
  // Number is exact to 53 bits; DBC signals wider than that lose precision.
  return Number(result);
}

function signExtend(value: number, bits: number): number {
  const limit = 2 ** (bits - 1);
  return value >= limit ? value - 2 ** bits : value;
}
