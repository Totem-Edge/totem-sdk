export { evaluateScript } from './eval.js';
export { simulateSpend } from './simulate.js';
export { buildWitness } from './witness.js';
export { parseScript } from './parser.js';
export { KissvmLimitError, KissvmRuntimeError } from './errors.js';
export { sigdig } from './eval.js';
export { MiniNumber } from './MiniNumber.js';

// WASM bridge (Rust-backed evaluator and parser)
export { evaluateScriptWasm, parseScriptWasm } from './wasm-sync.js';

export type {
  Value,
  EvalResult,
  ScriptWitness,
  ScriptProof,
  CoinData,
  OutputData,
  TxContext,
  ASTNode,
} from './types.js';

export type { WitnessInput } from './witness.js';

// ─── MAST infrastructure ────────────────────────────────────────────────────

export type {
  PolicyNode,
  PolicyTree,
  ProofLink,
  ProofChain,
  StateTransition,
  PrevStateWorkflow,
  VerificationResult,
} from './mast/types.js';

export {
  compileMastTree,
  compilePolicyGraph,
  verifyScriptMembership,
  computeCanonicalScriptHash,
  computeCanonicalScriptAddress,
} from './mast/mast-compiler.js';
export type {
  MinimaScriptProof,
  CompiledMast,
  CompiledPolicyNode,
  PolicyGraphNode,
  PolicyDelegationEdge,
  PolicyGraph,
  CompiledRecursivePolicy,
} from './mast/mast-compiler.js';

export {
  buildPolicyTree,
  findPolicyNode,
  getPolicyPath,
  getPolicyLeaves,
} from './mast/policy-tree.js';
export type { PolicyNodeInput } from './mast/policy-tree.js';

export {
  buildProofChain,
  verifyProofChain,
  toMinimaProofExpression,
  toTotemProofExpression,
  toProofExpression,
  toNestedMastScript,
} from './mast/proof-chain.js';

export {
  buildStateTransition,
  buildPrevStateWorkflow,
  counterWorkflow,
  vestingWorkflow,
  roundBasedWorkflow,
  timelockWorkflow,
} from './mast/prevstate.js';

export {
  buildLayeredPolicy,
  buildLayeredMastScript,
  buildLayerSubset,
  STANDARD_LAYERS,
} from './mast/layered-policy.js';
export type { PolicyLayer, LayeredPolicyConfig } from './mast/layered-policy.js';

export {
  buildPolicyAnchorScript,
  buildPolicyAnchorState,
  buildRootRotationScript,
  buildEpochAdvancementScript,
} from './mast/policy-anchor.js';
export type { PolicyAnchorConfig } from './mast/policy-anchor.js';

// ─── Templates (stable) ─────────────────────────────────────────────────────
//
// These templates are covered by the test suite and safe for production use.
// Experimental templates live in `@totemsdk/kissvm/experimental` and are
// NOT AUDITED — do not use them in production without independent review.

export {
  buildIdentityVerificationScript,
  buildDelegationProofScript,
  buildRotationScript,
  buildRevocationScript,
} from './templates/identity.js';
export type {
  IdentityVerificationConfig,
  DelegationProofConfig,
  RotationConfig,
  RevocationConfig,
} from './templates/identity.js';

export {
  buildMandateEnforcementScript,
  buildActionAuthorizationScript,
  buildRevocationScript as buildAuthorityRevocationScript,
  buildUsageTrackingScript,
} from './templates/authority.js';
export type {
  MandateEnforcementConfig,
  ActionAuthorizationConfig,
  RevocationConfig as AuthorityRevocationConfig,
  UsageTrackingConfig,
} from './templates/authority.js';

export {
  buildPaymentIntentScript,
  buildAgentProposalScript,
  buildPolicyEnforcementScript,
} from './templates/agent-policy.js';
export type {
  PaymentIntentConfig,
  AgentProposalConfig,
  PolicyEnforcementConfig,
} from './templates/agent-policy.js';

export {
  buildLeaseMessageScript,
  buildCoinUpdateScript,
  buildTrustMessageScript,
} from './templates/lookup-protocol.js';
export type {
  LeaseMessageConfig,
  CoinUpdateConfig,
  TrustMessageConfig,
} from './templates/lookup-protocol.js';

export {
  buildManifestBindingScript,
  buildCapabilityScript,
  buildManifestExpiryScript,
} from './templates/manifest.js';
export type {
  ManifestBindingConfig,
  CapabilityConfig,
  ManifestExpiryConfig,
} from './templates/manifest.js';

export {
  buildLinearRelease,
  buildCliffRelease,
  buildDeadlineScript,
  buildWindowScript,
  buildRateLimitScript,
  buildDecayScript,
  buildTemporalScript,
  computeRelease,
  MAX_DECIMAL,
} from './templates/temporal.js';
export type {
  ReleaseCurve,
  TemporalConfig,
} from './templates/temporal.js';

export {
  buildProofAnchorScript,
  buildCapabilityProofScript,
  buildRevocationProofScript,
  buildProofDelegationScript,
} from './templates/proof.js';
export type { ProofConfig } from './templates/proof.js';

export {
  buildLeaseCertificateScript,
  buildWatermarkTrackingScript,
  buildLeaseStateMachineScript,
} from './templates/wots-lease.js';
export type { LeaseCertificateConfig } from './templates/wots-lease.js';

export {
  buildCommitScript,
  buildRevealScript,
  buildActionStateMachineScript,
  buildEscrowEnforcementScript,
  IA_STATUS,
} from './templates/industrial-action.js';
export type {
  CommitConfig,
  RevealConfig,
  ActionStateMachineConfig,
  EscrowEnforcementConfig,
} from './templates/industrial-action.js';

export {
  buildLiquidityLockScript,
  buildFeeAccrualScript,
  buildWithdrawalScript,
  buildPositionStateMachineScript,
  POSITION_STATUS,
} from './templates/liquidity-bond.js';
export type { LiquidityLockConfig } from './templates/liquidity-bond.js';

export {
  buildBondLockupScript,
  buildHeartbeatScript,
  buildBondReleaseScript,
  buildBondStateMachineScript,
  buildChallengeScript,
  BOND_STATUS,
} from './templates/provider-bond.js';
export type { ProviderBondConfig } from './templates/provider-bond.js';

export {
  buildTxPoWValidationScript,
  buildMagicConstantsScript,
} from './templates/txpow.js';
export type { TxPoWValidationConfig } from './templates/txpow.js';

export {
  buildStatechainScript,
  buildStatechainOwnerRotationScript,
} from './templates/statechain.js';
export type { StateChainConfig } from './templates/statechain.js';

export {
  buildProposalStateMachineScript,
  buildVoteTallyScript,
  buildVoteSubmissionScript,
  buildExecutionMandateScript,
  buildTreasuryExecutionScript,
  computeScriptHash,
} from './templates/governance.js';
export type {
  ProposalConfig,
  VoteTallyConfig,
  VoteSubmissionConfig,
  ExecutionMandateConfig,
  TreasuryExecutionConfig,
} from './templates/governance.js';

export {
  buildEltooChannelScript,
  buildEltooFundingScript,
  buildEltooSettlementScript,
  buildFactoryFundingScript,
} from './templates/eltoo.js';
export type {
  EltooConfig,
  FactoryConfig,
} from './templates/eltoo.js';
