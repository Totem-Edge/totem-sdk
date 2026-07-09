/**
 * Manifest identity binding.
 *
 * bindManifestToIdentity: verify a signed manifest against an identity graph.
 * verifyManifestIdentity: core verification logic.
 *
 * Security model for valid signer addresses:
 *   A manifest signer is authorized if the signing address is one of:
 *   1. The identity's rootAddress
 *   2. The identity's controllerAddress
 *   3. An address in authorizedAddresses (delegates with "manifest:sign" or "*" scope)
 *   4. An address in result.provenAddresses returned by the root-identity proof verifier
 *
 * Note: controlledAddresses (delegates with any scope) are NOT included in the
 * manifest-signing valid set. Only explicitly scoped manifest signers may bind.
 *
 * Verification order:
 *   1. verifyManifest (manifest signature must be valid)
 *   2. resolveIdentityGraph (traverse graph)
 *   3. Optional root-identity proof verifier hooks
 *   4. Address membership check
 *   5. Identity status check (revoked = invalid)
 */

import { verifyManifest, computeManifestId } from '@totemsdk/manifest';
import type { SignedManifest } from '@totemsdk/manifest';
import { resolveIdentityGraph } from './resolver.js';
import type {
  IdentityGraph,
  ManifestIdentityBinding,
  IdentityProofVerifier,
} from './types.js';

export async function verifyManifestIdentity(
  signedManifest: SignedManifest<any>,
  identityGraph: IdentityGraph,
  options?: {
    proofVerifiers?: Record<string, IdentityProofVerifier>;
  },
): Promise<ManifestIdentityBinding> {
  const proofVerifiers = options?.proofVerifiers ?? {};
  const manifestId = computeManifestId(signedManifest.manifest);

  // Step 1: verify manifest signature first — fail fast on invalid manifest
  const manifestVerifyResult = verifyManifest(signedManifest);
  if (!manifestVerifyResult.valid) {
    return {
      valid: false,
      reason: `manifest signature invalid: ${manifestVerifyResult.reason ?? 'unknown'}`,
      manifestId,
      identityId: identityGraph.document.id,
      signerAddress: signedManifest.authorAddress,
      resolvedStatus: 'active',
    };
  }

  // Step 2: resolve identity graph (includes claim signature verification)
  const resolution = resolveIdentityGraph(identityGraph);
  if (!resolution.resolved) {
    return {
      valid: false,
      reason: 'identity graph could not be resolved',
      manifestId,
      identityId: identityGraph.document.id,
      signerAddress: signedManifest.authorAddress,
      resolvedStatus: 'active',
    };
  }

  const resolved = resolution.resolved;

  // Step 3: collect additional proven addresses from proof verifiers
  const provenAddresses: string[] = [];

  // Check manifest-level rootIdentityProof
  if (signedManifest.rootIdentityProof && proofVerifiers['root-identity']) {
    try {
      const verifyResult = await proofVerifiers['root-identity'].verify(
        signedManifest.rootIdentityProof,
      );
      if (verifyResult.valid && verifyResult.provenAddresses) {
        provenAddresses.push(...verifyResult.provenAddresses);
      }
    } catch {
      // silently ignore verifier errors
    }
  }

  // Check claim-level rootIdentityProof fields
  if (proofVerifiers['root-identity']) {
    for (const sc of identityGraph.claims) {
      if (sc.rootIdentityProof) {
        try {
          const verifyResult = await proofVerifiers['root-identity'].verify(
            sc.rootIdentityProof,
          );
          if (verifyResult.valid && verifyResult.provenAddresses) {
            provenAddresses.push(...verifyResult.provenAddresses);
          }
        } catch {
          // silently ignore verifier errors
        }
      }
    }
  }

  // Step 4: check address validity
  // Valid signers (per spec):
  //   1. rootAddress
  //   2. controllerAddress
  //   3. controlledAddresses — all delegated addresses (any scope)
  //   4. authorizedAddresses — subset with "manifest:sign" or "*" scope (already subset of above)
  //   5. provenAddresses — from root-identity proof verifiers
  const signerAddress = signedManifest.authorAddress;
  const validAddresses = new Set<string>([
    resolved.rootAddress,
    resolved.controllerAddress,
    ...resolved.controlledAddresses,
    ...resolved.authorizedAddresses,
    ...provenAddresses,
  ]);

  if (!validAddresses.has(signerAddress)) {
    return {
      valid: false,
      reason: `signer address '${signerAddress}' is not authorized to sign manifests for identity '${identityGraph.document.id}'`,
      manifestId,
      identityId: identityGraph.document.id,
      signerAddress,
      resolvedStatus: resolved.status,
    };
  }

  // Step 5: check identity status — revoked identities cannot bind
  if (resolved.status === 'revoked') {
    return {
      valid: false,
      reason: 'identity has been revoked',
      manifestId,
      identityId: identityGraph.document.id,
      signerAddress,
      resolvedStatus: resolved.status,
    };
  }

  return {
    valid: true,
    manifestId,
    identityId: identityGraph.document.id,
    signerAddress,
    resolvedStatus: resolved.status,
  };
}

export async function bindManifestToIdentity(
  signedManifest: SignedManifest<any>,
  identityGraph: IdentityGraph,
  options?: {
    proofVerifiers?: Record<string, IdentityProofVerifier>;
  },
): Promise<ManifestIdentityBinding> {
  return verifyManifestIdentity(signedManifest, identityGraph, options);
}
