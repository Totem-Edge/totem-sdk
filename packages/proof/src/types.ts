/**
 * @totemsdk/proof — Type definitions
 *
 * Pure schema — no network, no DHT, no blockchain submission.
 */

/**
 * Minimal signing indices matching @totemsdk/wots-lease's SigningIndices.
 * Kept here so signWithLease can accept any structurally compatible provider
 * without a hard dependency on @totemsdk/wots-lease.
 */
export interface SigningIndices {
  addressIndex: number;
  l1: number;
  l2: number;
}

export type ProofKind =
  | 'attestation'
  | 'ownership'
  | 'capability'
  | 'revocation'
  | 'delegation'
  | 'manifest'
  | 'identity'
  | 'custom';

export interface ProofSubject {
  id: string;
  kind: string;
  address?: string;
  metadata?: Record<string, unknown>;
}

export interface EvidenceRef {
  id: string;
  kind: string;
  hash: string;
  metadata?: Record<string, unknown>;
}

export interface AnchorRef {
  provider: string;
  hash: string;
  txId?: string;
  confirmedAt?: number;
  metadata?: Record<string, unknown>;
}

export interface ProofLink {
  proofId: string;
  kind: string;
}

export interface UnsignedProof {
  proofId: string;
  kind: ProofKind;
  subject: ProofSubject;
  issuer: string;
  issuedAt: number;
  expiresAt?: number;
  evidence?: EvidenceRef[];
  links?: ProofLink[];
  payload?: Record<string, unknown>;
}

/**
 * A proof after WOTS signing.
 *
 * `signature.message` is optional debug-only metadata — it is NEVER used as
 * the source of truth during verification. The digest is always recomputed
 * from the canonical JSON of the unsigned proof fields.
 */
export interface SignedProof extends UnsignedProof {
  signature: {
    address: string;
    publicKey: string;
    signature: string;
    message?: string;
  };
  anchor?: AnchorRef;
  rootIdentityProof?: string;
}

export interface ProofVerifyResult {
  valid: boolean;
  expired?: boolean;
  reason?: string;
  signerAddress?: string;
}

export interface ProofOperationResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  providerRef?: string;
}

export type ProofProviderCapability =
  | 'hash:stamp'
  | 'hash:check'
  | 'hash:verify'
  | 'proof:anchor'
  | 'proof:check'
  | 'proof:verify';

export interface ProofProvider {
  readonly capabilities: ProofProviderCapability[];
  stampHash?(params: { hash: string }): Promise<ProofOperationResult>;
  checkHash?(params: { hash: string }): Promise<ProofOperationResult>;
  verifyHash?(params: { hash: string; reportRequired?: boolean }): Promise<ProofVerifyResult>;
  anchorProof?(signedProof: SignedProof): Promise<ProofOperationResult>;
  checkProof?(signedProof: SignedProof): Promise<ProofOperationResult>;
  verifyProof?(signedProof: SignedProof, options?: { skipLocalVerification?: boolean }): Promise<ProofVerifyResult>;
}
