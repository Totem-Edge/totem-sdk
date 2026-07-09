/**
 * @module @totemsdk/root-identity
 *
 * Single root identity controlling up to 64 on-chain Minima addresses,
 * all cryptographically linked via genuine hierarchical key derivation.
 *
 * Architecture:
 *   root_priv_seed  = deriveRootPrivSeed(baseSeed)
 *   child_seed_i    = deriveUnifiedChildSeed(baseSeed, i)
 *   rootTreeKey     = TreeKey(root_priv_seed)  ← identity anchor, never spent
 *   childTreeKey_i  = TreeKey(child_seed_i)    ← Minima spend address i
 *
 * Use cases:
 *  - Chain-of-custody proofs
 *  - DAO multi-address attestation
 *  - Privacy-preserving KYC (selective disclosure)
 *  - NFT / token ownership linking
 */

export { UnifiedIdentityWallet, MAX_CHILD_COUNT } from './UnifiedIdentityWallet.js';
export type { WotsProof, OwnershipProof } from './types.js';
