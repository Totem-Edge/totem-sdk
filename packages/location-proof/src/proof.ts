/**
 * Proof envelope integration — build UnsignedProofs for location claims and
 * movement trails, sign them with WOTS keys, and verify signed location
 * proofs end to end.
 *
 * All signing/verification delegates to @totemsdk/proof. Anchoring is
 * deliberately NOT required for verification.
 */

import { createProof, signProof, signWithLease, verifyProof } from '@totemsdk/proof';
import type { UnsignedProof, SignedProof, EvidenceRef, SigningIndices } from '@totemsdk/proof';
import type { LocationClaim, MovementTrail } from './types.js';
import type { CreateLocationProofParams, LocationProofVerifyResult } from './types.js';
import { hashLocationClaim, hashMovementTrail, computeLocationClaimId } from './canonical.js';
import { isChallengeExpired, validateLocationClaim } from './claim.js';

/**
 * Convert a LocationClaim into an EvidenceRef for inclusion in a proof.
 */
export function locationClaimToEvidenceRef(claim: LocationClaim): EvidenceRef {
  return {
    id: claim.claimId,
    kind: 'location-claim',
    hash: hashLocationClaim(claim),
  };
}

/**
 * Convert a MovementTrail into an EvidenceRef for inclusion in a proof.
 */
export function movementTrailToEvidenceRef(trail: MovementTrail): EvidenceRef {
  return {
    id: trail.trailId,
    kind: 'movement-trail',
    hash: hashMovementTrail(trail),
  };
}

/**
 * Create an unsigned attestation proof for a location claim.
 *
 * The proof claims: "this device identity claimed this position, at this
 * time, with this source context, optionally linked to a challenge and
 * corroboration." It does NOT claim absolute or legally conclusive truth.
 */
export function createUnsignedLocationProof(params: CreateLocationProofParams): UnsignedProof {
  const { claim } = params;
  return createProof({
    kind: 'attestation',
    subject: {
      id: claim.subjectId,
      kind: 'location',
      metadata: {
        locationClaimId: claim.claimId,
        deviceId: claim.deviceId,
      },
    },
    issuer: params.issuer ?? claim.subjectId,
    issuedAt: params.issuedAt,
    expiresAt: params.expiresAt,
    evidence: [locationClaimToEvidenceRef(claim)],
    payload: { locationClaim: claim },
  });
}

/**
 * Sign an unsigned location proof with a WOTS key.
 *
 * The caller is responsible for reserving the WOTS key index (see
 * @totemsdk/wots-lease) before calling — one-time key warning applies.
 */
export function signLocationProof(
  unsigned: UnsignedProof,
  seed: Uint8Array,
  keyIndex: number,
): SignedProof {
  return signProof(unsigned, seed, keyIndex);
}

/**
 * Sign an unsigned location proof using a WOTS lease provider to reserve the
 * key index, preventing concurrent-use or restart-reuse of one-time WOTS keys.
 *
 * The lease provider must satisfy a minimal signature compatible with
 * @totemsdk/wots-lease's WotsLeaseProvider (see @totemsdk/proof.signWithLease).
 * Callers who manage key indices directly should use signLocationProof().
 *
 * On success the reservation is committed. On failure it is burned so the
 * index can be marked unavailable rather than silently lost.
 */
export async function signLocationProofWithLease(
  unsigned: UnsignedProof,
  seed: Uint8Array,
  leaseProvider: {
    reserveKeyUse(params: {
      treeId: string;
      ttlMs?: number;
      payloadHash?: string;
    }): Promise<{ reservationId: string; indices: SigningIndices }>;
    commitKeyUse(reservationId: string, txId: string): Promise<void>;
    burnReservation(reservationId: string, reason: string): Promise<void>;
  },
  options?: { treeId?: string; ttlMs?: number },
): Promise<SignedProof> {
  return signWithLease(unsigned, seed, leaseProvider, options);
}

/**
 * Verify a signed location proof end to end.
 *
 * Checks:
 *   1. the underlying @totemsdk/proof verification (signature, proofId, expiry)
 *   2. payload contains a structurally valid LocationClaim
 *   3. the claim's claimId matches a recomputation from its stable fields
 *   4. the location-claim evidence hash matches the payload claim
 *   5. the challenge (if present) has not expired
 *
 * Anchoring is not required.
 */
export function verifyLocationProof(
  signed: SignedProof,
  options?: { now?: number },
): LocationProofVerifyResult {
  const base = verifyProof(signed, { now: options?.now });
  if (!base.valid) {
    return {
      valid: false,
      reason: base.reason,
      expired: base.expired,
      signerAddress: base.signerAddress,
    };
  }

  const signerAddress = signed.signature.address;
  const claim = signed.payload?.['locationClaim'] as LocationClaim | undefined;
  if (!claim || typeof claim !== 'object') {
    return { valid: false, reason: 'payload missing locationClaim', signerAddress };
  }

  const validation = validateLocationClaim(claim);
  if (!validation.valid) {
    return {
      valid: false,
      reason: 'payload locationClaim invalid: ' + validation.errors.join('; '),
      payloadValid: false,
      signerAddress,
    };
  }

  const { claimId: _claimId, ...rest } = claim;
  const recomputedId = computeLocationClaimId(rest);
  if (recomputedId !== claim.claimId) {
    return {
      valid: false,
      reason: 'claimId does not match recomputed value',
      claimId: claim.claimId,
      signerAddress,
    };
  }

  const evidence = signed.evidence?.find((e) => e.id === claim.claimId && e.kind === 'location-claim');
  if (!evidence) {
    return {
      valid: false,
      reason: 'evidence missing location-claim ref',
      claimId: claim.claimId,
      signerAddress,
    };
  }
  const expectedHash = hashLocationClaim(claim);
  if (evidence.hash !== expectedHash) {
    return {
      valid: false,
      reason: 'evidence hash does not match payload claim',
      claimId: claim.claimId,
      evidenceHashValid: false,
      signerAddress,
    };
  }

  if (claim.challenge && isChallengeExpired(claim.challenge, options?.now ?? Date.now())) {
    return {
      valid: false,
      expired: true,
      reason: 'challenge expired',
      claimId: claim.claimId,
      signerAddress,
    };
  }

  return {
    valid: true,
    claimId: claim.claimId,
    payloadValid: true,
    evidenceHashValid: true,
    signerAddress,
  };
}
