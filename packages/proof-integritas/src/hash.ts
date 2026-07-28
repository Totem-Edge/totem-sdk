/**
 * @totemsdk/proof-integritas — Hash utilities.
 *
 * integritasHashFromProof: derives the canonical hash to submit to Integritas
 *   by calling createAnchorCommitment from @totemsdk/proof.
 * integritasAnchorRefFromResponse: maps a successful stamp response to AnchorRef.
 */

import { createAnchorCommitment } from '@totemsdk/proof';
import type { SignedProof, AnchorRef } from '@totemsdk/proof';
import type { IntegritasStampResponse } from './types.js';

/**
 * Compute the canonical hash submitted to Integritas for a given SignedProof.
 * Uses createAnchorCommitment so the hash is deterministic and tied to the
 * proof's identity — same proof always produces the same hash.
 */
export function integritasHashFromProof(signedProof: SignedProof): string {
  return createAnchorCommitment(signedProof);
}

/**
 * Map a successful Integritas stamp response to an AnchorRef
 * suitable for attaching to a SignedProof via attachAnchor.
 */
export function integritasAnchorRefFromResponse(
  response: IntegritasStampResponse,
): AnchorRef {
  return {
    provider: 'integritas',
    hash: response.hash ?? '',
    ...(response.txId !== undefined ? { txId: response.txId } : {}),
    ...(response.timestamp !== undefined ? { confirmedAt: response.timestamp } : {}),
  };
}
