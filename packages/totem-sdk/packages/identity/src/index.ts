/**
 * @module @totemsdk/identity
 *
 * Canonical identity and claims layer for Totem Edge.
 * Pure package — no network, no DHT, no blockchain submission.
 */

export { IDENTITY_VERSION } from './constants.js';

export type {
  IdentityKind,
  IdentityStatus,
  TotemIdentityDocument,
  IdentityClaim,
  IdentityClaimType,
  SignedIdentityClaim,
  IdentityVerifyResult,
  IdentityProofVerifier,
  IdentityGraph,
  ResolvedIdentity,
  IdentityResolutionResult,
  DelegationClaim,
  PaymentRecipientClaim,
  ServiceEndpointClaim,
  RotationClaim,
  RevocationClaim,
  ManifestIdentityBinding,
} from './types.js';

export { computeIdentityId, createIdentityDocument } from './document.js';

export {
  createIdentityClaim,
  createDelegationClaim,
  createPaymentRecipientClaim,
  createServiceEndpointClaim,
} from './claims.js';

export { signIdentityClaim } from './signing.js';
export { verifyIdentityClaim } from './verify.js';

export { rotateIdentity } from './rotation.js';
export { revokeIdentity } from './revocation.js';

export { resolveIdentityGraph } from './resolver.js';

export { bindManifestToIdentity, verifyManifestIdentity } from './manifest-binding.js';

export {
  isTotemIdentityDocument,
  isIdentityClaim,
  isSignedIdentityClaim,
  isRotationClaim,
  isRevocationClaim,
} from './guards.js';
