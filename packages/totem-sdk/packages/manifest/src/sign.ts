/**
 * signManifest — signs a manifest with a WOTS key.
 *
 * Steps:
 *   1. Canonicalise the manifest as deterministic JSON (sorted keys).
 *   2. SHA3-256 the UTF-8 bytes → 32-byte digest.
 *   3. Sign with wotsSign(seed, keyIndex, digest).
 *   4. Derive address + PKdigest via wotsKeypairFromSeed + wotsAddressFromKeypair.
 *   5. Return SignedManifest<T>.
 *
 * signerPublicKey in SignedManifest is the 32-byte WOTS PKdigest (hex, 64 chars).
 * This is the exact value expected by verifyManifest (via wotsVerifyDigest).
 *
 * The caller is responsible for reserving the WOTS key index before calling
 * this function. This package does NOT depend on @totemsdk/wots-lease.
 */

import { sha3_256 } from '@totemsdk/core';
import {
  wotsSign,
  wotsKeypairFromSeed,
  wotsAddressFromKeypair,
  bytesToHex,
} from '@totemsdk/core';
import type { Manifest, SignedManifest } from './types.js';

/** Produce a deterministic canonical JSON string with sorted keys (recursive). */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return '{' + pairs.join(',') + '}';
}

export function manifestDigest(manifest: Manifest): Uint8Array {
  const canonical = canonicalJson(manifest);
  return sha3_256(new TextEncoder().encode(canonical));
}

export async function signManifest<T extends Manifest>(
  manifest: T,
  seed: Uint8Array,
  keyIndex: number,
): Promise<SignedManifest<T>> {
  const digest = manifestDigest(manifest);
  const sigBytes = wotsSign(seed, keyIndex, digest);
  const kp = wotsKeypairFromSeed(seed, keyIndex);
  const address = wotsAddressFromKeypair(kp);

  return {
    manifest,
    authorAddress: address,
    signerPublicKey: bytesToHex(kp.pk),
    signedAt: Date.now(),
    signature: bytesToHex(sigBytes),
  };
}
