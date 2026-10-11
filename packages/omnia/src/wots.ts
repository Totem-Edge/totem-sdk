/**
 * Channel signature verification (RFC-037 — unified WOTS).
 *
 * Omnia channels use the wallet's WOTS scheme: a channel signature is a
 * serialized hierarchical `TreeSignature` (`serializeTreeSignature`), verified
 * against the party's `publicKeyDigest` (the tree-root public key) with
 * `verifyTreeSignature`. This is the same key the on-chain `MULTISIG(2 pkA pkB)`
 * eltoo script embeds.
 *
 * The legacy flat `wotsSign`/`wotsVerifyDigest` scheme was retired in RFC-037
 * Phase 3: hosts (`@totemsdk/omnia-host`) and wallets now sign channels with the
 * unified child TreeKey.
 */

import { deserializeTreeSignature, hexToBytes, verifyTreeSignature } from '@totemsdk/core';
import type { ChannelSignature } from './types.js';

/**
 * Verify a channel signature over `digest` for the party whose WOTS
 * `publicKeyDigest` (64 hex chars, tree-root public key) is given. Fails closed
 * on any error.
 */
export function verifyChannelSignature(
  signature: ChannelSignature,
  digest: Uint8Array,
  publicKeyDigest: string,
): boolean {
  if (!signature || !(signature instanceof Uint8Array) || signature.length === 0) return false;

  let pk: Uint8Array;
  try {
    pk = hexToBytes(publicKeyDigest);
  } catch {
    return false;
  }
  if (pk.length !== 32) return false;

  try {
    const treeSignature = deserializeTreeSignature(signature);
    return verifyTreeSignature(pk, digest, treeSignature);
  } catch {
    return false;
  }
}
