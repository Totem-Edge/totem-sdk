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
 * Root-identity proofs are verified and must resolve to the identity's root,
 * but a root-proven child does NOT grant `manifest:sign` by itself. Proven
 * addresses are returned as evidence only.
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
    /** Explicit resolution time. Defaults to Date.now() for compatibility. */
    asOf?: number;
  },
): Promise<ManifestIdentityBinding> {
  const proofVerifiers = options?.proofVerifiers ?? {};
  const asOf = options?.asOf ?? Date.now();
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

  if (signedManifest.signedAt > asOf) {
    return {
      valid: false,
      reason: `manifest was signed at ${signedManifest.signedAt}, after asOf ${asOf}`,
      manifestId,
      identityId: identityGraph.document.id,
      signerAddress: signedManifest.authorAddress,
      resolvedStatus: 'active',
    };
  }
  const manifestExpiresAt = (signedManifest.manifest as { expiresAt?: number }).expiresAt;
  if (manifestExpiresAt !== undefined && asOf > manifestExpiresAt) {
    return {
      valid: false,
      reason: `manifest expired at ${manifestExpiresAt}, before asOf ${asOf}`,
      manifestId,
      identityId: identityGraph.document.id,
      signerAddress: signedManifest.authorAddress,
      resolvedStatus: 'active',
    };
  }

  // Step 2: resolve identity graph (includes claim signature verification)
  const resolution = resolveIdentityGraph(identityGraph, { asOf });
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
        {
          expectedRootAddress: identityGraph.document.rootAddress,
          expectedAddress: signedManifest.authorAddress,
          purpose: 'manifest-binding',
        },
      );
      if (
        verifyResult.valid &&
        verifyResult.rootAddress === identityGraph.document.rootAddress &&
        verifyResult.provenAddresses
      ) {
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
            {
              expectedRootAddress: identityGraph.document.rootAddress,
              expectedAddress: sc.claim.issuer,
              purpose: 'manifest-binding',
            },
          );
          if (
            verifyResult.valid &&
            verifyResult.rootAddress === identityGraph.document.rootAddress &&
            verifyResult.provenAddresses
          ) {
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
  //   3. authorizedAddresses — delegates with "manifest:sign" or "*" scope
  // Root-proven children are evidence only; they do not grant manifest:sign.
  // RFC-020 C3: `controlledAddresses` (delegates with ANY scope, e.g. a
  // read-only `data:read` delegate) are deliberately NOT manifest signers.
  const signerAddress = signedManifest.authorAddress;
  const validAddresses = new Set<string>([
    resolved.rootAddress,
    resolved.controllerAddress,
    ...resolved.authorizedAddresses,
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
    ...(provenAddresses.length > 0 ? { provenAddresses: [...new Set(provenAddresses)] } : {}),
    ...(provenAddresses.length > 0
      ? { rootAddress: identityGraph.document.rootAddress }
      : {}),
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
