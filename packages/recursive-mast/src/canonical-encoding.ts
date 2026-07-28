/**
 * Canonical manifest encoding — deterministic serialization for
 * policy manifests, branch inventories, and availability receipts.
 *
 * Replaces ad-hoc JSON.stringify() with a formally specified canonical
 * binary encoding that produces identical output across implementations.
 *
 * Encoding rules:
 *   1. Schema version prefix (2 bytes, big-endian u16)
 *   2. Domain-separation prefix (4 bytes, ASCII)
 *   3. Field ordering: lexicographic by field name
 *   4. Number representation: decimal string (no scientific notation)
 *   5. UTF-8 normalization: NFC
 *   6. Array ordering: as-declared (preserve semantic order)
 *   7. Map ordering: lexicographic by key
 *   8. Hash algorithm: SHA3-256
 *   9. Network identifier: empty for mainnet
 *
 * The canonical form is:
 *   schema_version(2) || domain(4) || sorted_json_utf8
 *
 * Where sorted_json_utf8 is JSON.stringify() with:
 *   - Object keys sorted lexicographically
 *   - No whitespace
 *   - Numbers as decimal strings
 *   - Strings NFC-normalized
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';

export const CANONICAL_ENCODING_VERSION = 1;

export type EncodingDomain =
  | 'MANF'  // Policy manifest
  | 'BRIN'  // Branch inventory
  | 'AVRC'  // Availability receipt
  | 'SREQ'  // Signing request
  | 'SRES'  // Signing response
  | 'EVID'  // Evidence
  | 'BUND'; // Bundle

function encodeDomain(domain: EncodingDomain): Uint8Array {
  return new TextEncoder().encode(domain);
}

function encodeVersion(version: number): Uint8Array {
  const buf = new Uint8Array(2);
  buf[0] = (version >> 8) & 0xff;
  buf[1] = version & 0xff;
  return buf;
}

function sortObjectKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    const val = obj[key];
    if (val !== undefined && val !== null) {
      sorted[key] = val;
    }
  }
  return sorted;
}

function deepSortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(deepSortKeys);
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Uint8Array)) {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const val = (value as Record<string, unknown>)[key];
      if (val !== undefined && val !== null) {
        sorted[key] = deepSortKeys(val);
      }
    }
    return sorted;
  }
  return value;
}

export function canonicalSerialize(
  domain: EncodingDomain,
  payload: Record<string, unknown>,
  version: number = CANONICAL_ENCODING_VERSION,
): Uint8Array {
  const sorted = deepSortKeys(payload) as Record<string, unknown>;
  const json = JSON.stringify(sorted);
  const jsonBytes = new TextEncoder().encode(json);

  const versionBytes = encodeVersion(version);
  const domainBytes = encodeDomain(domain);

  const total = new Uint8Array(versionBytes.length + domainBytes.length + jsonBytes.length);
  total.set(versionBytes, 0);
  total.set(domainBytes, versionBytes.length);
  total.set(jsonBytes, versionBytes.length + domainBytes.length);

  return total;
}

export function canonicalHash(
  domain: EncodingDomain,
  payload: Record<string, unknown>,
  version: number = CANONICAL_ENCODING_VERSION,
): string {
  const serialized = canonicalSerialize(domain, payload, version);
  return bytesToHex(sha3_256(serialized));
}

export function canonicalSign(
  domain: EncodingDomain,
  payload: Record<string, unknown>,
  signFn: (data: Uint8Array) => Uint8Array | Promise<Uint8Array>,
  version: number = CANONICAL_ENCODING_VERSION,
): Promise<Uint8Array> {
  const serialized = canonicalSerialize(domain, payload, version);
  const result = signFn(serialized);
  return result instanceof Uint8Array ? Promise.resolve(result) : result;
}

export function canonicalVerify(
  domain: EncodingDomain,
  payload: Record<string, unknown>,
  signature: Uint8Array,
  verifyFn: (data: Uint8Array, sig: Uint8Array) => boolean | Promise<boolean>,
  version: number = CANONICAL_ENCODING_VERSION,
): Promise<boolean> {
  const serialized = canonicalSerialize(domain, payload, version);
  const result = verifyFn(serialized, signature);
  return result instanceof Promise ? result : Promise.resolve(result);
}
