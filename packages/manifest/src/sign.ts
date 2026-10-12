/**
 * signManifest — signs a manifest with the unified WOTS TreeKey (RFC-037).
 *
 * Steps:
 *   1. Canonicalise the manifest as deterministic JSON (sorted keys).
 *   2. SHA3-256 the UTF-8 bytes → 32-byte digest.
 *   3. Sign with the unified child TreeKey at `useIndex`:
 *      `serializeTreeSignature(treeKey.sign(digest))`.
 *   4. Derive the Minima address from the tree-root public key.
 *   5. Return SignedManifest<T>.
 *
 * `signerPublicKey` is the tree-root public key (hex). verifyManifest verifies
 * the serialized TreeSignature against it with `verifyTreeSignature`.
 *
 * The caller is responsible for reserving `useIndex` (a one-time leaf) before
 * calling this function. This package does NOT depend on @totemsdk/wots-lease.
 */

import {
  bytesToHex,
  scriptFromWotsPk,
  scriptToAddress,
  serializeTreeSignature,
  sha3_256,
  type TreeKey,
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
  treeKey: TreeKey,
  useIndex: number,
): Promise<SignedManifest<T>> {
  const digest = manifestDigest(manifest);
  const publicKey = treeKey.getPublicKey();
  treeKey.setUses(useIndex);
  const sigBytes = serializeTreeSignature(treeKey.sign(digest)) as Uint8Array;

  return {
    manifest,
    authorAddress: scriptToAddress(scriptFromWotsPk(publicKey)),
    signerPublicKey: bytesToHex(publicKey),
    signedAt: Date.now(),
    signature: bytesToHex(sigBytes),
  };
}
