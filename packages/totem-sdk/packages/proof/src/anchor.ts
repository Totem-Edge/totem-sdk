/**
 * Anchor helpers.
 *
 * createAnchorCommitment: deterministic hash of a proof for on-chain anchoring.
 * attachAnchor: attach an AnchorRef to a SignedProof without changing proofId.
 * verifyAnchorRef: recompute commitment and compare.
 */

import { sha3_256 } from '@noble/hashes/sha3.js';
import { toHex, canonicalJson } from './canonical.js';
import type { SignedProof, AnchorRef } from './types.js';

/**
 * Compute a deterministic anchor commitment for a SignedProof.
 * Used as the hash submitted to an anchoring provider (e.g. Integritas).
 */
export function createAnchorCommitment(signedProof: SignedProof): string {
  const input = 'totem-anchor' + signedProof.proofId + canonicalJson(signedProof.subject);
  return toHex(sha3_256(new TextEncoder().encode(input)));
}

/**
 * Attach an AnchorRef to a SignedProof.
 * The proofId MUST remain unchanged — anchor is mutable metadata outside the signed region.
 */
export function attachAnchor(signedProof: SignedProof, anchorRef: AnchorRef): SignedProof {
  return { ...signedProof, anchor: anchorRef };
}

/**
 * Verify that an AnchorRef.hash matches the expected commitment for this proof.
 */
export function verifyAnchorRef(signedProof: SignedProof, anchorRef: AnchorRef): boolean {
  const expected = createAnchorCommitment(signedProof);
  return expected === anchorRef.hash;
}
