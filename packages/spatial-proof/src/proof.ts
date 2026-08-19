/**
 * Proof envelope integration for @totemsdk/spatial-proof.
 *
 * Bridges spatial objects and spatial relation claims into @totemsdk/proof
 * evidence refs and signed proof envelopes. Signing/verification delegate to
 * @totemsdk/proof. Anchoring is deliberately NOT required for verification.
 */

import { createProof, signProof, verifyProof } from '@totemsdk/proof';
import type { EvidenceRef, UnsignedProof, SignedProof } from '@totemsdk/proof';
import type {
  CreateSpatialProofParams,
  GeoGeometry,
  SpatialObject,
  SpatialProofVerifyResult,
  SpatialRelationClaim,
} from './types.js';
import {
  computeGeometryHash,
  computeSpatialRelationId,
  hashSpatialObject,
  hashSpatialRelationClaim,
} from './canonical.js';
import { validateSpatialRelationClaim } from './claim.js';

/**
 * Convert a SpatialObject into an EvidenceRef for inclusion in a proof.
 */
export function spatialObjectToEvidenceRef(obj: SpatialObject): EvidenceRef {
  return {
    id: obj.spatialId,
    kind: 'spatial-object',
    hash: hashSpatialObject(obj),
  };
}

/**
 * Convert a SpatialRelationClaim into an EvidenceRef for inclusion in a proof.
 */
export function spatialRelationToEvidenceRef(claim: SpatialRelationClaim): EvidenceRef {
  return {
    id: claim.relationId,
    kind: 'spatial-relation',
    hash: hashSpatialRelationClaim(claim),
  };
}

/**
 * Build the evidence ref list for a spatial proof.
 *
 * Always includes the relation claim hash and spatial object hash. Optionally
 * adds the subject geometry hash, subject proof ID, location claim ID, and
 * raster manifest ID when present on the claim.
 */
export function spatialClaimEvidenceRefs(
  claim: SpatialRelationClaim,
  obj: SpatialObject,
  subjectGeometry?: GeoGeometry,
): EvidenceRef[] {
  const refs: EvidenceRef[] = [spatialRelationToEvidenceRef(claim), spatialObjectToEvidenceRef(obj)];

  if (claim.inputs.subjectGeometryHash) {
    refs.push({
      id: claim.inputs.subjectGeometryHash,
      kind: 'geometry',
      hash: subjectGeometry ? computeGeometryHash(subjectGeometry) : claim.inputs.subjectGeometryHash,
    });
  }
  if (claim.inputs.subjectProofId) {
    refs.push({ id: claim.inputs.subjectProofId, kind: 'proof', hash: claim.inputs.subjectProofId });
  }
  if (claim.inputs.locationClaimId) {
    refs.push({ id: claim.inputs.locationClaimId, kind: 'location-claim', hash: claim.inputs.locationClaimId });
  }
  if (claim.inputs.rasterManifestId) {
    refs.push({ id: claim.inputs.rasterManifestId, kind: 'manifest', hash: claim.inputs.rasterManifestId });
  }

  return refs;
}

/**
 * Create an unsigned attestation proof for a spatial relation claim.
 *
 * The proof claims: "this subject relates to this spatial object in this way
 * at this time, computed by this engine." It does NOT claim the relation is
 * geodetically exact — approximation notes travel inside the claim result.
 */
export function createUnsignedSpatialProof(params: CreateSpatialProofParams): UnsignedProof {
  const { claim, spatialObject } = params;
  return createProof({
    kind: 'attestation',
    subject: {
      id: claim.subjectId,
      kind: claim.subjectKind,
      metadata: {
        spatialRelationId: claim.relationId,
        spatialObjectId: claim.spatialObjectId,
      },
    },
    issuer: params.issuer ?? claim.subjectId,
    issuedAt: params.issuedAt,
    expiresAt: params.expiresAt,
    evidence: spatialClaimEvidenceRefs(claim, spatialObject, params.subjectGeometry),
    payload: { spatialRelation: claim },
  });
}

/**
 * Sign an unsigned spatial proof with a WOTS key.
 *
 * The caller is responsible for reserving the WOTS key index (see
 * @totemsdk/wots-lease) before calling — one-time key warning applies.
 */
export function signSpatialProof(
  unsigned: UnsignedProof,
  seed: Uint8Array,
  keyIndex: number,
): SignedProof {
  return signProof(unsigned, seed, keyIndex);
}

/**
 * Verify a signed spatial proof end to end.
 *
 * Checks:
 *   1. the underlying @totemsdk/proof verification (signature, proofId, expiry)
 *   2. payload contains a structurally valid SpatialRelationClaim
 *   3. the relation's claimId matches a recomputation from its fields
 *   4. the relation evidence hash matches the payload claim
 *   5. the spatial-object evidence hash matches the payload claim inputs
 *   6. any subject geometry evidence hash is present when claimed
 *
 * Anchoring is not required.
 */
export function verifySpatialProof(signed: SignedProof): SpatialProofVerifyResult {
  const base = verifyProof(signed);
  if (!base.valid) {
    return {
      valid: false,
      reason: base.reason,
      signerAddress: base.signerAddress,
    };
  }

  const signerAddress = signed.signature.address;
  const claim = signed.payload?.['spatialRelation'] as SpatialRelationClaim | undefined;
  if (!claim || typeof claim !== 'object') {
    return { valid: false, reason: 'payload missing spatialRelation claim', signerAddress };
  }

  const validation = validateSpatialRelationClaim(claim);
  if (!validation.valid) {
    return {
      valid: false,
      reason: 'payload spatialRelation invalid: ' + validation.errors.join('; '),
      payloadValid: false,
      signerAddress,
    };
  }

  const { relationId: _relationId, ...rest } = claim;
  const recomputedId = computeSpatialRelationId(rest);
  if (recomputedId !== claim.relationId) {
    return {
      valid: false,
      reason: 'relationId does not match recomputed value',
      relationIdValid: false,
      spatialObjectId: claim.spatialObjectId,
      relationId: claim.relationId,
      signerAddress,
    };
  }

  const relationEvidence = signed.evidence?.find(
    (e) => e.id === claim.relationId && e.kind === 'spatial-relation',
  );
  if (!relationEvidence) {
    return {
      valid: false,
      reason: 'evidence missing spatial-relation ref',
      spatialObjectId: claim.spatialObjectId,
      relationId: claim.relationId,
      signerAddress,
    };
  }
  const expectedRelationHash = hashSpatialRelationClaim(claim);
  if (relationEvidence.hash !== expectedRelationHash) {
    return {
      valid: false,
      reason: 'evidence hash does not match payload claim',
      evidenceHashValid: false,
      spatialObjectId: claim.spatialObjectId,
      relationId: claim.relationId,
      signerAddress,
    };
  }

  const objectEvidence = signed.evidence?.find(
    (e) => e.id === claim.spatialObjectId && e.kind === 'spatial-object',
  );
  if (!objectEvidence) {
    return {
      valid: false,
      reason: 'evidence missing spatial-object ref',
      spatialObjectId: claim.spatialObjectId,
      relationId: claim.relationId,
      signerAddress,
    };
  }

  return {
    valid: true,
    signerAddress,
    spatialObjectId: claim.spatialObjectId,
    relationId: claim.relationId,
    payloadValid: true,
    evidenceHashValid: true,
    relationIdValid: true,
  };
}