/**
 * Channel signature verification (RFC-037 — unified WOTS).
 *
 * Omnia channels must fit the wallet's WOTS scheme: the wallet signs with a
 * unified hierarchical `TreeKey` (`createUnifiedChildTreeKey`) whose root public
 * key is the address/Minima pubkey used in the on-chain `MULTISIG(2 pkA pkB)`
 * script. A channel signature is therefore a serialized `TreeSignature`
 * (`serializeTreeSignature`), verified against the party's `publicKeyDigest`
 * (the tree-root pubkey) with `verifyTreeSignature`.
 *
 * During the migration the legacy flat scheme (`wotsSign` → `wotsVerifyDigest`,
 * used by `@totemsdk/omnia-host`'s signer) is still accepted: the advertised
 * `publicKeyDigest` selects the scheme, so a flat leaf pubkey only verifies the
 * flat scheme and a tree root only verifies the hierarchical scheme. Retiring
 * the flat path is RFC-037 Phase 2.
 */

import {
  deserializeTreeSignature,
  hexToBytes,
  verifyTreeSignature,
  wotsVerifyDigest,
} from '@totemsdk/core';
import type { ChannelSignature } from './types.js';

/** Length of a flat `wotsSign` signature (34 chains × 32 bytes). */
export const FLAT_WOTS_SIGNATURE_LENGTH = 1088;

/**
 * Verify a channel signature over `digest` for the party whose WOTS
 * `publicKeyDigest` (64 hex chars) is given. Fails closed on any error.
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

  // Hierarchical (wallet TreeKey) — the canonical scheme.
  try {
    const treeSignature = deserializeTreeSignature(signature);
    if (verifyTreeSignature(pk, digest, treeSignature)) return true;
  } catch {
    // Not a serialized TreeSignature — fall through to the legacy flat path.
  }

  // Legacy flat WOTS (pre-RFC-037 host signer).
  if (signature.length === FLAT_WOTS_SIGNATURE_LENGTH) {
    try {
      return wotsVerifyDigest(signature, digest, pk);
    } catch {
      return false;
    }
  }

  return false;
}
