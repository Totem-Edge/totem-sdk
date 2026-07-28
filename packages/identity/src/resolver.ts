/**
 * Local-only identity graph resolver.
 *
 * Resolves an IdentityGraph into a ResolvedIdentity by:
 * - Verifying each claim's signature before accepting it
 * - Enforcing claim authority (only root, controller, or delegated addresses may issue)
 * - Detecting rotation/revocation
 * - Collecting payment recipients, service endpoints, delegations
 *
 * Security: every SignedIdentityClaim is passed through verifyIdentityClaim before
 * its issuer or content is trusted. Unsigned or tampered claims are silently dropped.
 *
 * Claim authority rules (after signature verification):
 *   A claim is only accepted if its issuer is:
 *     1. The subject's rootAddress
 *     2. The subject's controllerAddress
 *     3. An address holding an active + signature-verified delegates_to claim from the subject
 *   Claims from unauthorized issuers are silently dropped.
 */

import { verifyIdentityClaim } from './verify.js';
import type {
  IdentityGraph,
  IdentityResolutionResult,
  ResolvedIdentity,
  IdentityStatus,
  DelegationClaim,
  PaymentRecipientClaim,
  ServiceEndpointClaim,
  SignedIdentityClaim,
} from './types.js';

function isExpired(claim: { expiresAt?: number }): boolean {
  if (claim.expiresAt === undefined) return false;
  return Date.now() > claim.expiresAt;
}

export function resolveIdentityGraph(graph: IdentityGraph): IdentityResolutionResult {
  const { document, claims } = graph;
  const { rootAddress, controllerAddress } = document;

  // Step 1: signature-verify all claims upfront and collect the valid ones.
  // A claim is ONLY trusted when:
  //   (a) the WOTS signature is valid over the canonical claim bytes, AND
  //   (b) the cryptographic signer address (proof.address, bound to proof.publicKey via key
  //       derivation) exactly matches claim.issuer.
  // This prevents issuer-field spoofing: an attacker cannot set claim.issuer to a privileged
  // address (root, controller, delegate) if they signed with their own key.
  const verifiedClaims = claims.filter((sc) => {
    const result = verifyIdentityClaim(sc);
    return result.valid && result.signerAddress === sc.claim.issuer;
  });

  // Step 2: collect delegation claims issued by root or controller only (first-level authority).
  const rootDelegations = verifiedClaims.filter(
    (sc) =>
      sc.claim.type === 'delegates_to' &&
      sc.claim.subject === document.id &&
      (sc.claim.issuer === rootAddress || sc.claim.issuer === controllerAddress) &&
      !isExpired(sc.claim),
  );
  const firstLevelDelegates = new Set<string>(rootDelegations.map((sc) => sc.claim.object));

  // Full authorized issuer set
  const allAuthorized = new Set<string>([rootAddress, controllerAddress, ...firstLevelDelegates]);

  // Helper: claim is authorized if its issuer is in the authorized set and targets this identity
  function isAuthorized(sc: SignedIdentityClaim): boolean {
    return allAuthorized.has(sc.claim.issuer) && sc.claim.subject === document.id;
  }

  // Detect revocation
  const revocationClaims = verifiedClaims.filter(
    (sc) => sc.claim.type === 'revokes' && isAuthorized(sc),
  );
  const isRevoked = revocationClaims.length > 0;
  const revokedAt = isRevoked
    ? Math.min(...revocationClaims.map((sc) => sc.claim.issuedAt))
    : undefined;

  // Detect rotation
  const rotationClaims = verifiedClaims.filter(
    (sc) => sc.claim.type === 'rotates_to' && isAuthorized(sc) && !isExpired(sc.claim),
  );
  const rotationTarget = rotationClaims.length > 0 ? rotationClaims[0].claim.object : undefined;

  let status: IdentityStatus = 'active';
  if (isRevoked) status = 'revoked';
  else if (rotationTarget !== undefined) status = 'rotated';

  // Collect all delegation claims from authorized issuers
  const allDelegationSignedClaims = verifiedClaims.filter(
    (sc) =>
      sc.claim.type === 'delegates_to' &&
      sc.claim.subject === document.id &&
      allAuthorized.has(sc.claim.issuer) &&
      !isExpired(sc.claim),
  );

  const delegates: DelegationClaim[] = allDelegationSignedClaims.map((sc) => ({
    claimId: sc.claim.id,
    issuer: sc.claim.issuer,
    subject: sc.claim.subject,
    delegatedAddress: sc.claim.object,
    scopes: Array.isArray(sc.claim.payload.scopes) ? (sc.claim.payload.scopes as string[]) : [],
    issuedAt: sc.claim.issuedAt,
    expiresAt: sc.claim.expiresAt,
  }));

  // controlledAddresses: all delegated addresses (any scope) — for informational use
  const controlledAddresses: string[] = [...new Set(delegates.map((d) => d.delegatedAddress))];

  // authorizedAddresses: only delegates with manifest:sign or * scope
  const authorizedAddresses: string[] = [
    ...new Set(
      delegates
        .filter((d) => d.scopes.includes('*') || d.scopes.includes('manifest:sign'))
        .map((d) => d.delegatedAddress),
    ),
  ];

  // Payment recipients
  const paymentRecipients: PaymentRecipientClaim[] = verifiedClaims
    .filter(
      (sc) =>
        sc.claim.type === 'payment_recipient' &&
        isAuthorized(sc) &&
        !isExpired(sc.claim),
    )
    .map((sc) => ({
      claimId: sc.claim.id,
      issuer: sc.claim.issuer,
      address: sc.claim.object,
      label: typeof sc.claim.payload.label === 'string' ? sc.claim.payload.label : undefined,
      issuedAt: sc.claim.issuedAt,
      expiresAt: sc.claim.expiresAt,
    }));

  // Service endpoints
  const serviceEndpoints: ServiceEndpointClaim[] = verifiedClaims
    .filter(
      (sc) =>
        sc.claim.type === 'service_endpoint' &&
        isAuthorized(sc) &&
        !isExpired(sc.claim),
    )
    .map((sc) => ({
      claimId: sc.claim.id,
      issuer: sc.claim.issuer,
      endpointType: typeof sc.claim.payload.endpointType === 'string' ? sc.claim.payload.endpointType : 'unknown',
      uri: sc.claim.object,
      issuedAt: sc.claim.issuedAt,
      expiresAt: sc.claim.expiresAt,
    }));

  const resolved: ResolvedIdentity = {
    document,
    status,
    rootAddress,
    controllerAddress,
    controlledAddresses,
    authorizedAddresses,
    delegates,
    paymentRecipients,
    serviceEndpoints,
    rotationTarget,
    revokedAt,
  };

  return { resolved, errors: [] };
}
