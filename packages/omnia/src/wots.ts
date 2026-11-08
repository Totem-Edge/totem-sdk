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
 * Leaf path recovered from a hierarchical signature.
 *
 * `l1`/`l2` are the two least-significant path digits (the ones Omnia leases
 * and records); `high` is nonzero if the signature used a deeper path than the
 * lease model permits.
 */
export interface SignatureLeafBinding {
  l1: number;
  l2: number;
  high: number;
}

/**
 * Recover the signing leaf from the MMR proof carried by a TreeSignature.
 *
 * Each proof's chunks encode the leaf index in their `isLeft` flags, so the
 * claimed `signingIndices` can be checked against the signature itself rather
 * than trusted from the state payload.
 */
export function deriveSignatureLeafBinding(signature: ChannelSignature): SignatureLeafBinding | null {
  if (!signature || !(signature instanceof Uint8Array) || signature.length === 0) return null;
  try {
    const { proofs } = deserializeTreeSignature(signature);
    if (proofs.length === 0) return null;
    const path = proofs.map((proof) => {
      let index = 0;
      proof.mmrProof.chunks.forEach((chunk, row) => {
        if (chunk.isLeft) index += 2 ** row;
      });
      return index;
    });
    if (path.length === 1) return { l1: 0, l2: path[0], high: 0 };
    let high = 0;
    for (let i = 0; i < path.length - 2; i++) high = high * 64 + path[i];
    return { l1: path[path.length - 2], l2: path[path.length - 1], high };
  } catch {
    return null;
  }
}

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
