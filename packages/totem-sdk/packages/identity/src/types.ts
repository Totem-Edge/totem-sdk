/**
 * @totemsdk/identity — Type definitions
 *
 * Pure schema — no network, no DHT, no blockchain submission.
 */

export type IdentityKind =
  | 'person'
  | 'device'
  | 'agent'
  | 'service'
  | 'organization'
  | 'sensor'
  | 'robot'
  | 'gateway';

export type IdentityStatus = 'active' | 'rotated' | 'revoked';

export interface TotemIdentityDocument {
  id: string;
  kind: IdentityKind;
  version: number;
  rootAddress: string;
  controllerAddress: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export type IdentityClaimType =
  | 'delegates_to'
  | 'payment_recipient'
  | 'service_endpoint'
  | 'rotates_to'
  | 'revokes';

export interface IdentityClaim {
  id: string;
  type: IdentityClaimType;
  issuer: string;
  subject: string;
  object: string;
  issuedAt: number;
  expiresAt?: number;
  payload: Record<string, unknown>;
}

export interface SignedIdentityClaim {
  claim: IdentityClaim;
  proof: {
    address: string;
    publicKey: string;
    signature: string;
    message?: string;
  };
  rootIdentityProof?: string;
}

export interface IdentityVerifyResult {
  valid: boolean;
  reason?: string;
  signerAddress?: string;
  rootAddress?: string;
  provenAddresses?: string[];
  metadata?: Record<string, unknown>;
}

export interface IdentityProofVerifier {
  type: string;
  verify(proof: unknown): Promise<IdentityVerifyResult>;
}

export interface IdentityGraph {
  document: TotemIdentityDocument;
  claims: SignedIdentityClaim[];
}

export interface ResolvedIdentity {
  document: TotemIdentityDocument;
  status: IdentityStatus;
  rootAddress: string;
  controllerAddress: string;
  controlledAddresses: string[];
  authorizedAddresses: string[];
  delegates: DelegationClaim[];
  paymentRecipients: PaymentRecipientClaim[];
  serviceEndpoints: ServiceEndpointClaim[];
  rotationTarget?: string;
  revokedAt?: number;
}

export interface IdentityResolutionResult {
  resolved: ResolvedIdentity | null;
  errors: string[];
}

export interface DelegationClaim {
  claimId: string;
  issuer: string;
  subject: string;
  delegatedAddress: string;
  scopes: string[];
  issuedAt: number;
  expiresAt?: number;
}

export interface PaymentRecipientClaim {
  claimId: string;
  issuer: string;
  address: string;
  label?: string;
  issuedAt: number;
  expiresAt?: number;
}

export interface ServiceEndpointClaim {
  claimId: string;
  issuer: string;
  endpointType: string;
  uri: string;
  issuedAt: number;
  expiresAt?: number;
}

export interface RotationClaim {
  claimId: string;
  issuer: string;
  subject: string;
  newAddress: string;
  issuedAt: number;
}

export interface RevocationClaim {
  claimId: string;
  issuer: string;
  subject: string;
  reason?: string;
  issuedAt: number;
}

export interface ManifestIdentityBinding {
  valid: boolean;
  reason?: string;
  manifestId: string;
  identityId: string;
  signerAddress: string;
  resolvedStatus: IdentityStatus;
}
