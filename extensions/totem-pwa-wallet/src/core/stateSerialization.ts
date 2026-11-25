/**
 * stateSerialization.ts — Minima StateVariable encoding.
 *
 * Isolated from buildTxnRow.ts so the byte layout can be tested without the
 * WOTS/transaction pipeline. Mirrors Java StateVariable.writeDataStream().
 */
import { mxToHex } from '@totemsdk/core';
import type { StateVariable } from '@totemsdk/core';

export const STATETYPE_HEX = 1;
export const STATETYPE_NUMBER = 2;
export const STATETYPE_STRING = 4;
export const STATETYPE_BOOL = 8;

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, array) => sum + array.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const array of arrays) {
    out.set(array, offset);
    offset += array.length;
  }
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (!h.length) return new Uint8Array(0);
  const out = new Uint8Array(h.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function writeMiniData(data: Uint8Array): Uint8Array {
  const len = new Uint8Array(4);
  new DataView(len.buffer).setUint32(0, data.length, false);
  return concat(len, data);
}

function writeMiniNumber(value: bigint, scale = 0): Uint8Array {
  const sb = new Uint8Array([scale & 0xff]);
  if (value === 0n) return concat(sb, new Uint8Array([1, 0]));
  let h = value.toString(16);
  if (h.length & 1) h = '0' + h;
  const raw = hexToBytes(h);
  const data = raw[0] >= 0x80 ? concat(new Uint8Array([0]), raw) : raw;
  return concat(sb, new Uint8Array([data.length]), data);
}

/**
 * Hex state values accept Mx or 0x form. Java serializes them as MiniData, so
 * any even-length hex payload is valid (not just 32-byte hashes).
 */
export function normalizeStateHex(value: string): Uint8Array {
  const address = value.trim();
  if (!address) throw new Error('Hex StateVariable value cannot be empty');
  const hex = /^mx/i.test(address) ? mxToHex(address) : address;
  const clean = hex.replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]*$/.test(clean)) {
    throw new Error(`Hex StateVariable value contains non-hex characters: ${value}`);
  }
  if (clean.length % 2 !== 0) {
    throw new Error(`Hex StateVariable value has odd length: ${value}`);
  }
  return hexToBytes(clean);
}

export function serializeStateVariable(sv: StateVariable): Uint8Array {
  if (!Number.isInteger(sv.port) || sv.port < 0 || sv.port > 255) {
    throw new Error(`StateVariable port must be 0-255, got ${sv.port}`);
  }
  const portByte = new Uint8Array([sv.port]);

  let typeByte: Uint8Array;
  let dataBytes: Uint8Array;
  switch (sv.type) {
    case 'bool':
      typeByte = new Uint8Array([STATETYPE_BOOL]);
      if (typeof sv.value === 'boolean') {
        dataBytes = new Uint8Array([sv.value ? 1 : 0]);
      } else if (typeof sv.value === 'string') {
        dataBytes = new Uint8Array([sv.value.toUpperCase() === 'TRUE' ? 1 : 0]);
      } else {
        throw new Error(`Invalid bool StateVariable value: ${sv.value}`);
      }
      break;
    case 'number':
      typeByte = new Uint8Array([STATETYPE_NUMBER]);
      if (typeof sv.value === 'bigint') {
        dataBytes = writeMiniNumber(sv.value, 0);
      } else if (typeof sv.value === 'string') {
        dataBytes = writeMiniNumber(BigInt(sv.value), 0);
      } else {
        throw new Error(`Invalid number StateVariable value: ${sv.value}`);
      }
      break;
    case 'hex':
      typeByte = new Uint8Array([STATETYPE_HEX]);
      if (typeof sv.value === 'string') {
        dataBytes = writeMiniData(normalizeStateHex(sv.value));
      } else if (sv.value instanceof Uint8Array) {
        dataBytes = writeMiniData(sv.value);
      } else {
        throw new Error(`Invalid hex StateVariable value: ${sv.value}`);
      }
      break;
    case 'string':
      typeByte = new Uint8Array([STATETYPE_STRING]);
      if (typeof sv.value === 'string') {
        dataBytes = writeMiniData(new TextEncoder().encode(sv.value));
      } else {
        throw new Error(`Invalid string StateVariable value: ${sv.value}`);
      }
      break;
    default:
      throw new Error(`Unknown StateVariable type: ${(sv as { type?: string }).type}`);
  }

  return concat(portByte, typeByte, dataBytes);
}

/** State variable count (MiniNumber) followed by each serialized variable. */
export function serializeStateVariables(vars: readonly StateVariable[] = []): Uint8Array {
  return concat(
    writeMiniNumber(BigInt(vars.length)),
    ...vars.map(serializeStateVariable),
  );
}
