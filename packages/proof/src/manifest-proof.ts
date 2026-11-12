/**
 * Manifest proof helpers.
 *
 * createManifestProof: build an UnsignedProof with kind='manifest'.
 * verifyManifestProof: verify that a proof actually attests the given manifest.
 *
 * Binding matters: verifying the manifest signature and the proof envelope
 * independently proves nothing about the pair. Without a binding, a proof
 * issued for one manifest (or for a different kind of claim entirely) verifies
 * against any correctly signed manifest.
 */

import { canonicalJson } from '@totemsdk/core';
import { sha3_256 } from '@totemsdk/core';
import { verifyManifest } from '@totemsdk/manifest';
import type { Manifest, SignedManifest } from '@totemsdk/manifest';
import { createProof, verifyProof } from './proof.js';
import type { UnsignedProof, SignedProof, ProofSubject, EvidenceRef, ProofVerifyResult } from './types.js';

export interface CreateManifestProofParams {
  subject: ProofSubject;
  issuer: string;
  /** Content id of the manifest revision: `computeManifestContentId(signedManifest.manifest)`. */
  manifestId: string;
  issuedAt?: number;
  expiresAt?: number;
  evidence?: EvidenceRef[];
}

/**
 * Content id of a manifest revision: SHA3-256 over the canonical manifest.
 *
 * `computeManifestId` is deliberately stable across versions (it identifies the
 * manifest, not the revision), so it cannot bind a proof to a specific version.
 * This digest changes with any field, version included. It mirrors the
 * canonicalisation `signManifest` signs over.
 */
export function manifestContentId(manifest: Manifest): string {
  return bytesToHex(sha3_256(new TextEncoder().encode(canonicalJson(manifest))));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Address that must have authored the manifest, per manifest type. */
function manifestAuthor(manifest: Manifest): string | undefined {
  switch (manifest.type) {
    case 'app':
      return manifest.authorAddress;
    case 'capability':
      return manifest.agentAddress;
    case 'dapp':
      return manifest.authorAddress;
    case 'edge-service':
      return manifest.operatorAddress;
    default:
      return undefined;
  }
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

/**
 * Build a manifest proof whose id is derived from the manifest itself, so it
 * cannot be created with a mismatched id by accident.
 */
export function createManifestProofFor(
  signedManifest: SignedManifest<any>,
  params: Omit<CreateManifestProofParams, 'manifestId' | 'issuer'> & { issuer?: string },
): UnsignedProof {
  const author = manifestAuthor(signedManifest.manifest);
  if (!author) throw new Error('createManifestProofFor: unsupported manifest type');
  return createManifestProof({
    ...params,
    issuer: params.issuer ?? author,
    manifestId: manifestContentId(signedManifest.manifest),
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

  if (signedProof.kind !== 'manifest') {
    return {
      valid: false,
      reason: `proof kind '${String(signedProof.kind)}' is not 'manifest'`,
      signerAddress: signedProof.signature?.address,
    };
  }

  const expectedId = manifestContentId(signedManifest.manifest);
  const claimedId = (signedProof.payload as { manifestId?: unknown } | undefined)?.manifestId;
  if (typeof claimedId !== 'string' || claimedId !== expectedId) {
    return {
      valid: false,
      reason: `manifest id mismatch: proof attests '${String(claimedId)}' but the manifest is '${expectedId}'`,
      signerAddress: signedProof.signature?.address,
    };
  }

  const author = manifestAuthor(signedManifest.manifest);
  if (!author) {
    return {
      valid: false,
      reason: `unsupported manifest type '${String(signedManifest.manifest.type)}'`,
      signerAddress: signedProof.signature?.address,
    };
  }
  if (signedProof.issuer !== author) {
    return {
      valid: false,
      reason: `proof issuer '${signedProof.issuer}' is not the manifest author '${author}'`,
      signerAddress: signedProof.signature?.address,
    };
  }

  return verifyProof(signedProof);
}
