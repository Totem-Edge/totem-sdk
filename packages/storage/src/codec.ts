/**
 * @module @totemsdk/storage/codec
 *
 * Versioned value codec.
 *
 * The storage encoding is distinct from signed canonicalization
 * (`@totemsdk/core` `canonicalJson`/`hashCanonical`): committed bytes and
 * hashes must never be silently re-encoded, so any encoding change ships with an
 * explicit version bump.
 *
 * Format v1: a 5-byte header (`TSK1` magic + version byte) followed by UTF-8
 * JSON. `bigint` and `Uint8Array` values are tagged in-band (`{"$b":"12"}` and
 * `{"$u":"<hex>"}`) so no bare `JSON.stringify(BigInt)` ever reaches the wire.
 * Non-finite numbers and `undefined` values are rejected rather than silently
 * dropped or coerced.
 */

import { StorageError } from './errors.js';

export const CODEC_MAGIC = new Uint8Array([0x54, 0x53, 0x4b, 0x31]); // "TSK1"
export const CODEC_VERSION = 1;

export interface Codec {
  readonly version: number;
  serialize(value: unknown): Uint8Array;
  deserialize(data: Uint8Array): unknown;
}

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) {
    throw new Error(`invalid hex: ${hex}`);
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

const BIGINT_TAG = '$b';
const BYTES_TAG = '$u';

function tagValue(value: unknown): unknown {
  if (value === null) return null;
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return value;
    case 'number':
      if (!Number.isFinite(value)) {
        throw new StorageError(`codec: non-finite number ${value}`, 'write-failed');
      }
      return value;
    case 'bigint':
      return { [BIGINT_TAG]: value.toString() };
    case 'object':
      if (value instanceof Uint8Array) {
        return { [BYTES_TAG]: toHex(value) };
      }
      if (Array.isArray(value)) {
        return value.map((item) => tagValue(item));
      }
      {
        const out: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
          if (item === undefined) {
            throw new StorageError(`codec: undefined value for key "${key}"`, 'write-failed');
          }
          out[key] = tagValue(item);
        }
        return out;
      }
    default:
      throw new StorageError(`codec: unsupported value of type ${typeof value}`, 'write-failed');
  }
}

function untagValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => untagValue(item));
  }
  const record = value as Record<string, unknown>;
  const objectKeys = Object.keys(record);
  if (objectKeys.length === 1 && typeof record[BIGINT_TAG] === 'string') {
    const digits = record[BIGINT_TAG] as string;
    if (!/^-?\d+$/.test(digits)) {
      throw new StorageError(`codec: malformed bigint tag`, 'corrupt');
    }
    return BigInt(digits);
  }
  if (objectKeys.length === 1 && typeof record[BYTES_TAG] === 'string') {
    try {
      return fromHex(record[BYTES_TAG] as string);
    } catch {
      throw new StorageError(`codec: malformed bytes tag`, 'corrupt');
    }
  }
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(record)) {
    out[key] = untagValue(item);
  }
  return out;
}

function assertHeader(data: Uint8Array): number {
  if (data.length < CODEC_MAGIC.length + 1) {
    throw new StorageError(`codec: record too short (${data.length} bytes)`, 'corrupt');
  }
  for (let i = 0; i < CODEC_MAGIC.length; i += 1) {
    if (data[i] !== CODEC_MAGIC[i]) {
      throw new StorageError(`codec: unknown record magic`, 'corrupt');
    }
  }
  return data[CODEC_MAGIC.length];
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

class VersionedCodec implements Codec {
  readonly version = CODEC_VERSION;

  serialize(value: unknown): Uint8Array {
    let json: string;
    try {
      json = JSON.stringify(tagValue(value));
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError(`codec: serialization failed: ${(err as Error).message}`, 'write-failed', { cause: err });
    }
    const body = new TextEncoder().encode(json);
    return concat(concat(CODEC_MAGIC, new Uint8Array([this.version])), body);
  }

  deserialize(data: Uint8Array): unknown {
    const version = assertHeader(data);
    if (version > CODEC_VERSION) {
      throw new StorageError(
        `codec: unsupported format version ${version} (this build supports up to ${CODEC_VERSION})`,
        'corrupt',
        { detectedVersion: version, unsupportedVersion: version },
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(data.slice(CODEC_MAGIC.length + 1)));
    } catch (err) {
      throw new StorageError(`codec: corrupt payload: ${(err as Error).message}`, 'corrupt', { cause: err });
    }
    try {
      return untagValue(parsed);
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError(`codec: corrupt payload`, 'corrupt', { cause: err });
    }
  }
}

export const codec: Codec = new VersionedCodec();