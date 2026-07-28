/**
 * @module @totemsdk/proof-integritas
 *
 * Integritas v2 proof provider adapter for @totemsdk/proof.
 *
 * Integritas (https://integritas.minima.global/core/v2) anchors hashes on-chain
 * on Minima. This package adapts the Integritas REST API to the ProofProvider
 * interface so any @totemsdk/proof consumer can use it as a drop-in anchoring
 * backend.
 *
 * What this package does:
 *   - Hash stamping, checking, and verification via Integritas
 *   - Anchoring SignedProof hashes (createAnchorCommitment) on Minima
 *   - PDF report generation (report:pdf capability)
 *   - NFT trace and on-chain verification
 *
 * What this package does NOT do:
 *   - WOTS signing — see @totemsdk/proof for that
 *   - proofgraph resolution — see @totemsdk/proofgraph
 *   - SDK-level caching or storage
 *   - OAuth — only x-api-key header authentication
 */

export { createIntegritasProofProvider } from './provider.js';

export {
  normalizeIntegritasStampResponse,
  normalizeIntegritasCheckResponse,
  normalizeIntegritasVerifyResponse,
} from './normalize.js';

export {
  integritasHashFromProof,
  integritasAnchorRefFromResponse,
} from './hash.js';

export type {
  IntegritasConfig,
  IntegritasCapability,
  IntegritasExtendedCapability,
  IntegritasStampResponse,
  IntegritasCheckResponse,
  IntegritasVerifyResponse,
} from './types.js';
