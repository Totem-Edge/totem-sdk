/**
 * Proof envelope integration for @totemsdk/raster-proof.
 *
 * Bridges raster manifests, window proofs and Merkle proofs into
 * @totemsdk/proof evidence refs and signed proof envelopes. Signing and
 * verification delegate to @totemsdk/proof. Anchoring is deliberately NOT
 * required for verification.
 */

import { createProof, signProof, verifyProof } from '@totemsdk/proof';
import type { EvidenceRef, SignedProof, UnsignedProof } from '@totemsdk/proof';
import type {
  CreateRasterProofParams,
  RasterManifest,
  RasterMerkleProof,
  RasterProofVerifyResult,
  RasterWindowProof,
} from './types.js';
import {
  computeRasterManifestId,
  computeRasterWindowProofId,
  hashRasterManifest,
} from './canonical.js';
import { validateRasterManifest, rasterManifestToEvidenceRef } from './manifest.js';
import { rasterWindowProofToEvidenceRef } from './window.js';
import { structuralDerivationCheck } from './provenance.js';
import { verifyMerkleProof } from './merkle.js';

/**
 * Build the evidence ref list for a raster proof:
 *   - raster manifest hash
 *   - content hash
 *   - Merkle root when present
 *   - window proof hash when present
 *   - source raster IDs when derived
 *   - spatial object ID when present
 */
export function rasterEvidenceRefs(
  manifest: RasterManifest,
  windowProof?: RasterWindowProof,
  spatialObjectId?: string,
): EvidenceRef[] {
  const refs: EvidenceRef[] = [
    rasterManifestToEvidenceRef(manifest),
    { id: manifest.asset.contentHash, kind: 'raster-content', hash: manifest.asset.contentHash },
  ];

  if (manifest.asset.merkleRoot) {
    refs.push({ id: manifest.rasterId + ':merkle', kind: 'raster-merkle-root', hash: manifest.asset.merkleRoot });
  }
  if (windowProof) {
    refs.push(rasterWindowProofToEvidenceRef(windowProof));
  }
  if (manifest.provenance?.derivedFrom) {
    for (const src of manifest.provenance.derivedFrom) {
      refs.push({ id: src, kind: 'raster-source', hash: src });
    }
  }
  if (spatialObjectId) {
    refs.push({ id: spatialObjectId, kind: 'spatial-object', hash: spatialObjectId });
  }

  return refs;
}

/**
 * Create an unsigned attestation proof for a raster manifest.
 *
 * The proof claims: "this manifest describes this asset, produced by this
 * source, at this time, with this content hash / Merkle root". It does NOT
 * claim the visual interpretation is correct — interpretation is an
 * operator / model / reviewer claim made elsewhere.
 */
export function createUnsignedRasterProof(params: CreateRasterProofParams): UnsignedProof {
  const { manifest, windowProof, merkleProofs, spatialObjectId } = params;
  return createProof({
    kind: 'attestation',
    subject: {
      id: manifest.rasterId,
      kind: 'raster-manifest',
      metadata: {
        sourceType: manifest.sourceType,
        layerType: manifest.layerType,
      },
    },
    issuer: params.issuer ?? manifest.deviceId ?? manifest.operatorId ?? manifest.rasterId,
    issuedAt: params.issuedAt,
    expiresAt: params.expiresAt,
    evidence: rasterEvidenceRefs(manifest, windowProof, spatialObjectId),
    payload: {
      rasterManifest: manifest,
      ...(windowProof ? { windowProof } : {}),
      ...(merkleProofs && merkleProofs.length > 0 ? { merkleProofs } : {}),
    },
  });
}

/**
 * Sign an unsigned raster proof with a WOTS key.
 *
 * The caller is responsible for reserving the WOTS key index (see
 * @totemsdk/wots-lease) before calling — one-time key warning applies.
 */
export function signRasterProof(
  unsigned: UnsignedProof,
  seed: Uint8Array,
  keyIndex: number,
): SignedProof {
  return signProof(unsigned, seed, keyIndex);
}

/**
 * Verify a window proof payload against the manifest and any supplied Merkle
 * proofs. Returns a failure reason string, or null when valid.
 */
function checkWindowProof(
  windowProof: RasterWindowProof,
  manifest: RasterManifest,
  merkleProofs: RasterMerkleProof[] | undefined,
): string | null {
  const { windowProofId: _wid, ...rest } = windowProof;
  if (computeRasterWindowProofId(rest) !== windowProof.windowProofId) {
    return 'windowProofId does not match recomputed value';
  }
  if (manifest.asset.merkleRoot && windowProof.merkleRoot !== manifest.asset.merkleRoot) {
    return 'window proof merkleRoot does not match manifest asset.merkleRoot';
  }
  if (windowProof.rasterId !== manifest.rasterId) {
    return 'window proof rasterId does not match manifest';
  }
  if (windowProof.chunkIndices.length === 0 || windowProof.chunkIndices.length !== windowProof.chunkHashes.length) {
    return 'window proof chunkIndices must be non-empty and match chunkHashes length';
  }

  for (const proof of merkleProofs ?? []) {
    if (!verifyMerkleProof(proof)) {
      return 'a supplied merkle proof failed verification';
    }
    if (windowProof.merkleRoot && proof.root !== windowProof.merkleRoot) {
      return 'a supplied merkle proof root does not match the window proof root';
    }
    if (!windowProof.chunkIndices.includes(proof.leafIndex)) {
      return 'a supplied merkle proof leafIndex is not referenced by the window proof';
    }
  }

  return null;
}

/**
 * Verify a signed raster proof end to end.
 *
 * Checks:
 *   1. the underlying @totemsdk/proof verification (signature, proofId, expiry)
 *   2. payload contains a structurally valid RasterManifest
 *   3. the manifest rasterId matches a recomputation from its fields
 *   4. the manifest evidence hash matches the payload manifest
 *   5. content hash and Merkle root evidence refs are present when declared
 *   6. window proof (when supplied) has a recomputable ID, matches the
 *      manifest's Merkle root, and any supplied Merkle proofs verify
 *   7. provenance structure is valid for derived rasters
 *
 * Anchoring is not required. Source raster manifests are not supplied inside
 * the proof, so derivation checks are structural only (full cross-source
 * verification is @totemsdk/raster-proof's verifyRasterDerivation).
 */
export function verifyRasterProof(signed: SignedProof): RasterProofVerifyResult {
  const base = verifyProof(signed);
  if (!base.valid) {
    return {
      valid: false,
      reason: base.reason,
      signerAddress: base.signerAddress,
    };
  }

  const signerAddress = signed.signature.address;
  const manifest = signed.payload?.['rasterManifest'] as RasterManifest | undefined;
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, reason: 'payload missing rasterManifest', signerAddress };
  }

  const validation = validateRasterManifest(manifest);
  if (!validation.valid) {
    return {
      valid: false,
      reason: 'payload rasterManifest invalid: ' + validation.errors.join('; '),
      payloadValid: false,
      rasterId: manifest.rasterId,
      signerAddress,
    };
  }

  const { rasterId: _rasterId, ...rest } = manifest;
  if (computeRasterManifestId(rest) !== manifest.rasterId) {
    return {
      valid: false,
      reason: 'rasterId does not match recomputed value',
      rasterIdValid: false,
      rasterId: manifest.rasterId,
      signerAddress,
    };
  }

  const manifestEvidence = signed.evidence?.find((e) => e.id === manifest.rasterId && e.kind === 'raster-manifest');
  if (!manifestEvidence) {
    return {
      valid: false,
      reason: 'evidence missing raster-manifest ref',
      rasterId: manifest.rasterId,
      signerAddress,
    };
  }
  if (manifestEvidence.hash !== hashRasterManifest(manifest)) {
    return {
      valid: false,
      reason: 'evidence hash does not match payload manifest',
      manifestHashValid: false,
      rasterId: manifest.rasterId,
      signerAddress,
    };
  }

  const contentEvidence = signed.evidence?.find((e) => e.kind === 'raster-content');
  if (!contentEvidence || contentEvidence.hash !== manifest.asset.contentHash) {
    return {
      valid: false,
      reason: 'evidence missing or mismatched raster-content hash',
      rasterId: manifest.rasterId,
      signerAddress,
    };
  }

  if (manifest.asset.merkleRoot) {
    const merkleEvidence = signed.evidence?.find((e) => e.kind === 'raster-merkle-root');
    if (!merkleEvidence || merkleEvidence.hash !== manifest.asset.merkleRoot) {
      return {
        valid: false,
        reason: 'evidence missing or mismatched raster-merkle-root',
        rasterId: manifest.rasterId,
        signerAddress,
      };
    }
  }

  const windowProof = signed.payload?.['windowProof'] as RasterWindowProof | undefined;
  if (windowProof) {
    const merkleProofs = signed.payload?.['merkleProofs'] as RasterMerkleProof[] | undefined;
    const err = checkWindowProof(windowProof, manifest, merkleProofs);
    if (err) {
      return {
        valid: false,
        reason: err,
        windowProofValid: false,
        rasterId: manifest.rasterId,
        signerAddress,
      };
    }
  }

  if (manifest.sourceType === 'derived') {
    const derivation = structuralDerivationCheck(manifest);
    if (!derivation.valid) {
      return {
        valid: false,
        reason: 'derivation structure invalid: ' + derivation.reasons?.join('; '),
        derivationValid: false,
        rasterId: manifest.rasterId,
        signerAddress,
      };
    }
  }

  return {
    valid: true,
    signerAddress,
    rasterId: manifest.rasterId,
    payloadValid: true,
    rasterIdValid: true,
    manifestHashValid: true,
    ...(windowProof ? { windowProofValid: true } : {}),
    ...(manifest.sourceType === 'derived' ? { derivationValid: true } : {}),
  };
}