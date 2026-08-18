/**
 * Byte / string hashing for @totemsdk/raster-proof.
 *
 * SHA3-256 comes from @totemsdk/core. All hashes are lowercase hex without a
 * 0x prefix. No Node crypto, no WASM gating — safe on edge devices.
 */

import { sha3_256 } from '@totemsdk/core';
import { toHex } from './canonical.js';

/**
 * SHA3-256 hash of raw bytes → lowercase hex (no 0x prefix).
 */
export function hashBytes(bytes: Uint8Array): string {
  return toHex(sha3_256(bytes));
}

/**
 * SHA3-256 hash of a UTF-8 string → lowercase hex (no 0x prefix).
 */
export function hashString(value: string): string {
  return toHex(sha3_256(new TextEncoder().encode(value)));
}

/**
 * Hash a chunk's bytes in-place using hashBytes. Kept as a named helper so
 * callers can hash arbitrary sub-byte-ranges without allocating.
 */
export function hashSubarray(bytes: Uint8Array, offset: number, length: number): string {
  return hashBytes(bytes.subarray(offset, offset + length));
}
