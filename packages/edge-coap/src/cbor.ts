/**
 * Minimal CBOR (RFC 8949) decoder for constrained-device payloads.
 *
 * Supports the deterministic core used by sensors: unsigned/negative
 * integers, byte/text strings, arrays, maps, tags (unwrapped), booleans, null,
 * undefined, half/single/double floats and indefinite-length containers.
 * Maps with all-text keys decode to plain objects; other maps decode to `Map`.
 *
 * This is a decoder, not a general CBOR library: it does not expose tag
 * semantics and rejects malformed, truncated, duplicate-key or over-deep input.
 */

export type CborValue =
  | null
  | undefined
  | boolean
  | number
  | bigint
  | string
  | Uint8Array
  | CborValue[]
  | { [key: string]: CborValue }
  | Map<CborValue, CborValue>;

export interface CborDecodeOptions {
  /** Maximum nesting depth. Default 32. */
  maxDepth?: number;
}

export class CborDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CborDecodeError';
  }
}

const BREAK = 0xff;
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

export function decodeCbor(input: Uint8Array, options: CborDecodeOptions = {}): CborValue {
  if (!(input instanceof Uint8Array)) throw new CborDecodeError('CBOR input must be a Uint8Array');
  const state = { offset: 0 };
  const value = decodeItem(input, state, 0, options.maxDepth ?? 32);
  if (state.offset !== input.length) {
    throw new CborDecodeError(`Trailing ${input.length - state.offset} byte(s) after CBOR item`);
  }
  return value;
}

interface Cursor {
  offset: number;
}

function decodeItem(input: Uint8Array, cursor: Cursor, depth: number, maxDepth: number): CborValue {
  if (depth > maxDepth) throw new CborDecodeError(`CBOR nesting exceeds ${maxDepth}`);
  const initial = readByte(input, cursor);
  const major = initial >> 5;
  const additional = initial & 0x1f;

  switch (major) {
    case 0: {
      const argument = readArgument(input, cursor, additional);
      return integer(argument);
    }
    case 1: {
      const argument = readArgument(input, cursor, additional);
      const value = integer(argument);
      if (typeof value === 'bigint') return -1n - value;
      return -1 - value;
    }
    case 2:
      return decodeByteString(input, cursor, additional);
    case 3:
      return decodeTextString(input, cursor, additional);
    case 4:
      return decodeArray(input, cursor, additional, depth, maxDepth);
    case 5:
      return decodeMap(input, cursor, additional, depth, maxDepth);
    case 6: {
      // Tags are structural metadata; sensor claims do not need them. Read and
      // unwrap, but reject indefinite tag numbers.
      const argument = readArgument(input, cursor, additional);
      if (argument === 'indefinite') throw new CborDecodeError('Indefinite CBOR tag');
      return decodeItem(input, cursor, depth + 1, maxDepth);
    }
    default:
      return decodeSimple(input, cursor, additional);
  }
}

function integer(argument: bigint | 'indefinite'): number | bigint {
  if (argument === 'indefinite') throw new CborDecodeError('Indefinite CBOR integer');
  return argument <= MAX_SAFE ? Number(argument) : argument;
}

function decodeByteString(input: Uint8Array, cursor: Cursor, additional: number): Uint8Array {
  const argument = readArgument(input, cursor, additional);
  if (argument !== 'indefinite') return readBytes(input, cursor, toLength(argument, 'byte string'));
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (!atBreak(input, cursor)) {
    const header = peekByte(input, cursor);
    if (header >> 5 !== 2 || (header & 0x1f) === 0x1f) {
      throw new CborDecodeError('Indefinite CBOR byte string contains a non-definite chunk');
    }
    cursor.offset++;
    const length = toLength(readArgument(input, cursor, header & 0x1f) as bigint, 'byte string chunk');
    chunks.push(readBytes(input, cursor, length));
    total += length;
  }
  cursor.offset++;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length; }
  return out;
}

function decodeTextString(input: Uint8Array, cursor: Cursor, additional: number): string {
  const argument = readArgument(input, cursor, additional);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  if (argument !== 'indefinite') {
    return decodeUtf8(decoder, readBytes(input, cursor, toLength(argument, 'text string')));
  }
  let text = '';
  while (!atBreak(input, cursor)) {
    const header = peekByte(input, cursor);
    if (header >> 5 !== 3 || (header & 0x1f) === 0x1f) {
      throw new CborDecodeError('Indefinite CBOR text string contains a non-definite chunk');
    }
    cursor.offset++;
    const length = toLength(readArgument(input, cursor, header & 0x1f) as bigint, 'text string chunk');
    text += decodeUtf8(decoder, readBytes(input, cursor, length));
  }
  cursor.offset++;
  return text;
}

function decodeArray(input: Uint8Array, cursor: Cursor, additional: number, depth: number, maxDepth: number): CborValue[] {
  const argument = readArgument(input, cursor, additional);
  const values: CborValue[] = [];
  if (argument === 'indefinite') {
    while (!atBreak(input, cursor)) values.push(decodeItem(input, cursor, depth + 1, maxDepth));
    cursor.offset++;
    return values;
  }
  const length = toLength(argument, 'array');
  for (let i = 0; i < length; i++) values.push(decodeItem(input, cursor, depth + 1, maxDepth));
  return values;
}

function decodeMap(input: Uint8Array, cursor: Cursor, additional: number, depth: number, maxDepth: number): CborValue {
  const argument = readArgument(input, cursor, additional);
  const entries: Array<[CborValue, CborValue]> = [];
  const readPair = () => {
    const key = decodeItem(input, cursor, depth + 1, maxDepth);
    const value = decodeItem(input, cursor, depth + 1, maxDepth);
    entries.push([key, value]);
  };
  if (argument === 'indefinite') {
    while (!atBreak(input, cursor)) readPair();
    cursor.offset++;
  } else {
    const length = toLength(argument, 'map');
    for (let i = 0; i < length; i++) readPair();
  }

  if (entries.every(([key]) => typeof key === 'string')) {
    const object: { [key: string]: CborValue } = {};
    const keys = new Set<string>();
    for (const [key, value] of entries) {
      const name = key as string;
      if (name === '__proto__') throw new CborDecodeError('CBOR map contains a reserved key');
      if (keys.has(name)) throw new CborDecodeError(`Duplicate CBOR map key '${name}'`);
      keys.add(name);
      object[name] = value;
    }
    return object;
  }

  const map = new Map<CborValue, CborValue>();
  for (const [key, value] of entries) {
    if (map.has(key)) throw new CborDecodeError('Duplicate CBOR map key');
    map.set(key, value);
  }
  return map;
}

function decodeSimple(input: Uint8Array, cursor: Cursor, additional: number): CborValue {
  switch (additional) {
    case 20: return false;
    case 21: return true;
    case 22: return null;
    case 23: return undefined;
    case 24:
      // Simple values outside the well-known set are not used by this profile.
      throw new CborDecodeError(`Unsupported CBOR simple value ${readByte(input, cursor)}`);
    case 25: {
      const bits = readUint(input, cursor, 2);
      return decodeFloat16(Number(bits));
    }
    case 26: return readFloat(input, cursor, 4).getFloat32(0, false);
    case 27: return readFloat(input, cursor, 8).getFloat64(0, false);
    case 31: throw new CborDecodeError('Unexpected CBOR break');
    default: throw new CborDecodeError(`Unsupported CBOR simple value ${additional}`);
  }
}

function decodeFloat16(bits: number): number {
  const sign = bits & 0x8000 ? -1 : 1;
  const exponent = (bits >> 10) & 0x1f;
  const fraction = bits & 0x3ff;
  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024);
  if (exponent === 31) return fraction === 0 ? sign * Infinity : Number.NaN;
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}

function readArgument(input: Uint8Array, cursor: Cursor, additional: number): bigint | 'indefinite' {
  if (additional < 24) return BigInt(additional);
  if (additional === 24) return readUint(input, cursor, 1);
  if (additional === 25) return readUint(input, cursor, 2);
  if (additional === 26) return readUint(input, cursor, 4);
  if (additional === 27) return readUint(input, cursor, 8);
  if (additional === 31) return 'indefinite';
  throw new CborDecodeError(`Reserved CBOR additional information ${additional}`);
}

function toLength(argument: bigint, label: string): number {
  if (argument > BigInt(Number.MAX_SAFE_INTEGER)) throw new CborDecodeError(`CBOR ${label} length is too large`);
  const length = Number(argument);
  if (length > 0xffffffff) throw new CborDecodeError(`CBOR ${label} length is too large`);
  return length;
}

function readByte(input: Uint8Array, cursor: Cursor): number {
  if (cursor.offset >= input.length) throw new CborDecodeError('Truncated CBOR input');
  return input[cursor.offset++];
}

function peekByte(input: Uint8Array, cursor: Cursor): number {
  if (cursor.offset >= input.length) throw new CborDecodeError('Truncated CBOR input');
  return input[cursor.offset];
}

function readBytes(input: Uint8Array, cursor: Cursor, length: number): Uint8Array {
  if (cursor.offset + length > input.length) throw new CborDecodeError('Truncated CBOR string');
  const value = input.slice(cursor.offset, cursor.offset + length);
  cursor.offset += length;
  return value;
}

function readUint(input: Uint8Array, cursor: Cursor, length: number): bigint {
  if (cursor.offset + length > input.length) throw new CborDecodeError('Truncated CBOR argument');
  let value = 0n;
  for (let i = 0; i < length; i++) value = (value << 8n) | BigInt(input[cursor.offset + i]);
  cursor.offset += length;
  return value;
}

function readFloat(input: Uint8Array, cursor: Cursor, length: number): DataView {
  if (cursor.offset + length > input.length) throw new CborDecodeError('Truncated CBOR float');
  const view = new DataView(input.buffer, input.byteOffset + cursor.offset, length);
  cursor.offset += length;
  return view;
}

function atBreak(input: Uint8Array, cursor: Cursor): boolean {
  return peekByte(input, cursor) === BREAK;
}

function decodeUtf8(decoder: { decode(input?: Uint8Array): string }, bytes: Uint8Array): string {
  try {
    return decoder.decode(bytes);
  } catch {
    throw new CborDecodeError('Invalid UTF-8 in CBOR text string');
  }
}
