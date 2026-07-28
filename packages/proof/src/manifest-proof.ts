/**
 * Manifest proof helpers.
 *
 * createManifestProof: build an UnsignedProof with kind='manifest'.
 * verifyManifestProof: verify both the manifest signature and the proof envelope.
 */

import { verifyManifest } from '@totemsdk/manifest';
import type { SignedManifest } from '@totemsdk/manifest';
import { createProof, verifyProof } from './proof.js';
import type { UnsignedProof, SignedProof, ProofSubject, EvidenceRef, ProofVerifyResult } from './types.js';

export interface CreateManifestProofParams {
  subject: ProofSubject;
  issuer: string;
  manifestId: string;
  issuedAt?: number;
  expiresAt?: number;
  evidence?: EvidenceRef[];
}

export function createManifestProof(params: CreateManifestProofParams): UnsignedProof {
  return createProof({
    kind: 'manifest',
    subject: params.subject,
    issuer: params.issuer,
    issuedAt: params.issuedAt,
    expiresAt: params.expiresAt,
    evidence: params.evidence,
    payload: { manifestId: params.manifestId },
  });
}

export function verifyManifestProof(
  signedProof: SignedProof,
  signedManifest: SignedManifest<any>,
): ProofVerifyResult {
  const manifestResult = verifyManifest(signedManifest);
  if (!manifestResult.valid) {
    return {
      valid: false,
      reason: `manifest signature invalid: ${manifestResult.reason ?? 'unknown'}`,
      signerAddress: signedProof.signature?.address,
    };
  }
  return verifyProof(signedProof);
}
