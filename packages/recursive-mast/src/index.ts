/**
 * @module @totemsdk/recursive-mast
 *
 * Nested MAST + PREVSTATE library for Minima KISSVM — the complete policy
 * coordination library for composable, multi-party, cryptographically
 * provable governance.
 *
 * Nested MAST is proof-authenticated dynamic loading of bounded executable
 * modules. A MAST statement references a Merkle/MMR root; the transaction
 * witness supplies a script + proof resolving to that root. The loaded
 * script executes in the same contract context and may itself contain
 * another MAST statement referencing a different root.
 *
 * This library provides:
 *   - Policy tree builder — hierarchical governance structures
 *   - Proof chain builder — multi-level nested MAST verification
 *   - PREVSTATE workflows — state transition templates
 *   - Delegation chain manager — authority delegation
 *   - Cross-domain trust bridge — inter-policy-space trust
 *   - Migration path constructor — upgradeable policy systems
 *   - Layered policy builder — composable 7-layer authority chains
 *   - Policy Anchor Coin — dynamic roots via PREVSTATE
 *   - Policy Manifest — signed discoverable policy metadata
 *   - Policy Signing — request/response coordination
 *   - Signing Session — multi-party transaction state machine
 *   - Policy Discovery — announce, query, resolve, watch
 *   - Institutional Recovery — threshold, time-delayed, epoch-based
 *   - Branch Capsule — self-contained script+proof packages
 *   - Policy Store — storage-agnostic interface (memory, HTTP, custom)
 *   - Content Keys — content-addressed key scheme
 *   - Availability Audit — data-availability diagnostics
 *   - Encrypted Branches — private policy branches
 *   - KISSVM Integration — script validation, witness materialization, simulation
 *   - Transaction Integration — policy-aware transaction planning (optional tx-builder)
 *   - Templates — ready-to-use KISSVM scripts for common workflows (EXPERIMENTAL)
 */

// ─── Re-exports from @totemsdk/kissvm ──────────────────────────────────────
// The following modules moved to KISSVM in v0.4.
// Re-exported here for backward compatibility.

export type {
  PolicyNode,
  PolicyTree,
  ProofLink,
  ProofChain,
  StateTransition,
  PrevStateWorkflow,
  VerificationResult,
} from '@totemsdk/kissvm';

export {
  buildPolicyTree,
  findPolicyNode,
  getPolicyPath,
  getPolicyLeaves,
} from '@totemsdk/kissvm';
export type { PolicyNodeInput } from '@totemsdk/kissvm';

export {
  buildProofChain,
  verifyProofChain,
  toMinimaProofExpression,
  toTotemProofExpression,
  toProofExpression,
  toNestedMastScript,
} from '@totemsdk/kissvm';

export {
  buildStateTransition,
  buildPrevStateWorkflow,
  counterWorkflow,
  vestingWorkflow,
  roundBasedWorkflow,
  timelockWorkflow,
} from '@totemsdk/kissvm';

// ─── Delegation chain ───────────────────────────────────────────────────────

export {
  buildDelegationLink,
  buildDelegationScript,
  buildDelegationChain,
  verifyDelegationChain,
  toDelegationChainScript,
} from './delegation.js';

// ─── Cross-domain trust ─────────────────────────────────────────────────────

export {
  buildCrossDomainBridge,
  buildAcceptanceScript,
  buildBidirectionalBridge,
  buildTrustNetwork,
} from './cross-domain.js';

// ─── Migration path ────────────────────────────────────────────────────────

export {
  buildMigrationStep,
  buildMigrationScript,
  buildMigrationPath,
  isMigrationActive,
  isMigrationComplete,
  getActivePolicyRoot,
  toMigrationPathScript,
} from './migration.js';

// ─── Layered policy (re-exported from @totemsdk/kissvm) ─────────────────────

export {
  buildLayeredPolicy,
  buildLayeredMastScript,
  buildLayerSubset,
  STANDARD_LAYERS,
} from '@totemsdk/kissvm';
export type { PolicyLayer, LayeredPolicyConfig } from '@totemsdk/kissvm';

// ─── Policy Anchor Coin (re-exported from @totemsdk/kissvm) ─────────────────

export {
  buildPolicyAnchorScript,
  buildPolicyAnchorState,
  buildRootRotationScript,
  buildEpochAdvancementScript,
} from '@totemsdk/kissvm';
export type { PolicyAnchorConfig } from '@totemsdk/kissvm';

// ─── Policy Manifest ───────────────────────────────────────────────────────

export {
  computePolicyPackageHash,
  signPolicyManifest,
  splitPolicyManifest,
} from './policy-manifest.js';
export type {
  PolicyAction,
  PolicyRole,
  PolicyEndpoint,
  RecursiveMastPolicyManifest,
  RestrictedBranchPackage,
} from './policy-manifest.js';

// ─── Policy Signing ────────────────────────────────────────────────────────

export {
  createSigningRequest,
  createSigningResponse,
  collectSigningResponses,
  buildRecursiveWitnessPlan,
  verifySigningRequest,
} from './policy-signing.js';
export type {
  PolicySigningRequest,
  PolicySigningResponse,
  PolicyPathDescriptor,
  ScriptDisclosure,
  SignedEvidence,
  SignedIdentityClaim,
  ExpectedInput,
  ExpectedOutput,
  CreateSigningRequestConfig,
  CreateSigningResponseConfig,
  SigningRoundResult,
} from './policy-signing.js';

// ─── Signing Session ───────────────────────────────────────────────────────

export {
  createSigningSession,
  advanceSession,
  acceptResponse,
  recordEvidence,
  submitSession,
  confirmSession,
  cancelSession,
  sessionSummary,
} from './signing-session.js';
export type {
  SigningSessionStatus,
  RequiredRoleState,
  EvidenceState,
  SigningSession,
  SigningSessionConfig,
} from './signing-session.js';

// ─── Policy Discovery ──────────────────────────────────────────────────────

export {
  announcePolicy,
  queryPolicies,
  resolvePolicyForSubject,
  watchPolicy,
} from './discovery.js';
export type {
  PolicyLookupClient,
  PolicyQueryResult,
  PolicyUpdateNotification,
  AnnouncePolicyConfig,
  QueryPolicyConfig,
  ResolvePolicyConfig,
  ResolvedPolicy,
  WatchPolicyConfig,
} from './discovery.js';

// ─── Branch Capsule ─────────────────────────────────────────────────────────

export {
  serializeBranchPackage,
  deserializeBranchPackage,
  verifyBranchPackage,
  createBranchPackage,
  branchSummary,
} from './branch-capsule.js';
export type {
  MastBranchPackage,
  BranchFilter,
  MastBranchSummary,
} from './branch-capsule.js';

// ─── Content Keys ──────────────────────────────────────────────────────────

export {
  KEY_PREFIX,
  policyManifestKey,
  scriptKey,
  proofKey,
  bundleKey,
  parseContentKey,
  computeBundleHash,
  computeScriptHash,
} from './content-keys.js';
export type { ContentKey } from './content-keys.js';

// ─── Policy Store ───────────────────────────────────────────────────────────

export type {
  RecursiveMastPolicyStore,
  MirrorResult,
} from './policy-store.js';

// ─── Memory Store ──────────────────────────────────────────────────────────

export { MemoryPolicyStore } from './store-memory.js';
export type { MemoryStoreOptions } from './store-memory.js';

// ─── HTTP Store ─────────────────────────────────────────────────────────────

export { HttpPolicyStore } from './store-http.js';
export type { HttpStoreOptions } from './store-http.js';

// ─── Availability ───────────────────────────────────────────────────────────

export { auditPolicyAvailability } from './availability.js';
export type {
  AvailabilityPolicy,
  PolicyAvailabilityReport,
  AuditConfig,
} from './availability.js';

// ─── Encrypted Branch ───────────────────────────────────────────────────────

export {
  createEncryptedBranch,
  decryptBranch,
  isEncryptedBranch,
  encryptedBranchPublicMetadata,
} from './encrypted-branch.js';
export type {
  EncryptedBranchPackage,
  DecryptedBranchResult,
} from './encrypted-branch.js';

// ─── MAST Compiler (re-exported from @totemsdk/kissvm) ──────────────────────

export {
  compileMastTree,
  compilePolicyGraph,
  verifyScriptMembership,
  computeCanonicalScriptHash,
  computeCanonicalScriptAddress,
} from '@totemsdk/kissvm';
export type {
  MinimaScriptProof,
  CompiledMast,
  CompiledPolicyNode,
  PolicyGraphNode,
  PolicyDelegationEdge,
  PolicyGraph,
  CompiledRecursivePolicy,
} from '@totemsdk/kissvm';

// ─── Branded Types ──────────────────────────────────────────────────────────

export {
  asBlockHeight,
  asBlockDuration,
  asUnixTimeMs,
  asUnixTimeSec,
  unixTimeMsToSec,
  unixTimeSecToMs,
  nowMs,
  nowSec,
} from './branded-types.js';
export type {
  BlockHeight,
  BlockDuration,
  UnixTimeMs,
  UnixTimeSec,
} from './branded-types.js';

// ─── Policy Signer ──────────────────────────────────────────────────────────

export type {
  PolicySigner,
  PolicySignature,
  PolicySignerConfig,
  SigningDomain,
} from './policy-signer.js';

// ─── Canonical Encoding ─────────────────────────────────────────────────────

export {
  CANONICAL_ENCODING_VERSION,
  canonicalSerialize,
  canonicalHash,
  canonicalSign,
  canonicalVerify,
} from './canonical-encoding.js';
export type { EncodingDomain } from './canonical-encoding.js';

// ─── Branch Inventory ────────────────────────────────────────────────────────

export {
  computeBranchInventoryHash,
  getCriticalBranches,
  getRecoveryBranches,
  getBranchesByAction,
  getBranchesByRole,
  validateInventoryCoverage,
} from './branch-inventory.js';
export type {
  BranchInventoryEntry,
  BranchInventory,
} from './branch-inventory.js';

// ─── Availability Receipts ───────────────────────────────────────────────────

export {
  createAvailabilityReceipt,
  signAvailabilityReceipt,
  verifyAvailabilityReceipt,
  receiptCoversBranch,
  receiptCoversInventory,
} from './availability-receipts.js';
export type { AvailabilityReceipt } from './availability-receipts.js';

// ─── Encryption Envelope ────────────────────────────────────────────────────

export {
  ENCRYPTION_ALGORITHMS,
  ENVELOPE_VERSION,
  serializeEncryptionEnvelope,
  deserializeEncryptionEnvelope,
  computeKeyFingerprint,
  createEncryptionEnvelope,
  createKeyWrappingEnvelope,
  serializeKeyWrappingEnvelope,
  deserializeKeyWrappingEnvelope,
} from './encryption-envelope.js';
export type {
  EncryptionAlgorithm,
  EncryptionEnvelope,
  KeyWrappingEnvelope,
} from './encryption-envelope.js';
