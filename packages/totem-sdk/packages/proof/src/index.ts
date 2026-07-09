/**
 * @module @totemsdk/proof
 *
 * Portable proof layer for Totem Edge.
 * Pure package — no network, no DHT, no blockchain submission.
 *
 * EdgeProofPort context: @totemsdk/edge/src/ports.ts defines a stub EdgeProofPort
 * with unknown types. The free functions (createProof, signProof, verifyProof) and
 * the ProofProvider interface here are the concrete implementations that will be
 * bridged into EdgeProofPort in a future @totemsdk/edge update.
 */

export type {
  ProofKind,
  ProofSubject,
  EvidenceRef,
  AnchorRef,
  ProofLink,
  UnsignedProof,
  SignedProof,
  ProofVerifyResult,
  ProofOperationResult,
  ProofProviderCapability,
  ProofProvider,
} from './types.js';

export {
  toHex,
  canonicalJson,
  computeProofId,
  hashProofPayload,
  hashEvidence,
} from './canonical.js';

export type { CreateProofParams } from './proof.js';
export {
  createProof,
  signProof,
  verifyProofSignature,
  verifyProofPayload,
  verifyProof,
} from './proof.js';

export {
  createAnchorCommitment,
  attachAnchor,
  verifyAnchorRef,
} from './anchor.js';

export type { CreateManifestProofParams } from './manifest-proof.js';
export {
  createManifestProof,
  verifyManifestProof,
} from './manifest-proof.js';

export type { CreateIdentityProofParams } from './identity-proof.js';
export {
  createIdentityProof,
  verifyIdentityProof,
} from './identity-proof.js';
