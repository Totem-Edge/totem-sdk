/**
 * Identity proof helpers.
 *
 * createIdentityProof: build an UnsignedProof with kind='identity'.
 * verifyIdentityProof: verify both the identity claim and the proof envelope.
 *
 * Uses @totemsdk/identity types (TotemIdentityDocument, SignedIdentityClaim).
 * Does NOT import from @totemsdk/root-identity.
 */

import { verifyIdentityClaim } from '@totemsdk/identity';
import type { SignedIdentityClaim } from '@totemsdk/identity';
import { createProof, verifyProof } from './proof.js';
import type { UnsignedProof, SignedProof, ProofSubject, EvidenceRef, ProofVerifyResult } from './types.js';

export interface CreateIdentityProofParams {
  subject: ProofSubject;
  issuer: string;
  identityId: string;
  issuedAt?: number;
  expiresAt?: number;
  evidence?: EvidenceRef[];
}

export function createIdentityProof(params: CreateIdentityProofParams): UnsignedProof {
  return createProof({
    kind: 'identity',
    subject: params.subject,
    issuer: params.issuer,
    issuedAt: params.issuedAt,
    expiresAt: params.expiresAt,
    evidence: params.evidence,
    payload: { identityId: params.identityId },
  });
}

export function verifyIdentityProof(
  signedProof: SignedProof,
  signedClaim: SignedIdentityClaim,
): ProofVerifyResult {
  const claimResult = verifyIdentityClaim(signedClaim);
  if (!claimResult.valid) {
    return {
      valid: false,
      reason: `identity claim invalid: ${claimResult.reason ?? 'unknown'}`,
      signerAddress: signedProof.signature?.address,
    };
  }
  return verifyProof(signedProof);
}
