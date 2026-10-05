/**
 * Canonical JSON hashing (RFC-031 Fix A).
 *
 * Split out of `canonical.ts` so that `canonicalJson`/`toHex` are wasm-free:
 * only `hashCanonical` needs the WASM `sha3_256` kernel.
 */
import { sha3_256 } from './wasm-sync.js';
import { canonicalJson, toHex } from './canonical.js';

export function hashCanonical(domain: string, value: unknown): string {
  const input = domain + canonicalJson(value);
  return toHex(sha3_256(new TextEncoder().encode(input)));
}
