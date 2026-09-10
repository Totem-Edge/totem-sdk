/**
 * @totemsdk/agent-policy — Interface contracts and policy middleware
 *
 * This package defines the seam between the deterministic Phase 1.5
 * sovereignty stack and the optional Phase 2 intelligence layer:
 * language-agnostic Protobuf contracts plus composable policy middleware
 * primitives (rate limits, amount caps, recipient allowlists, time windows,
 * risk thresholds, authority-backed approval).
 *
 * Principle: the AI proposes, Totem validates and signs.
 * The AI never holds a private key. It never calls reserveKeyUse.
 * It never constructs a raw transaction. It fills in a PaymentIntent.
 *
 * ## Language-agnostic schema
 *
 * The canonical schema is defined in Protobuf at:
 *   proto/totem/agent/policy/v1/agent_policy.proto
 *
 * TypeScript types are generated from this schema. Python, Go, and Rust
 * consumers can generate their own bindings from the same .proto file.
 */

// Original TypeScript types (backward-compatible, string unions)
export type {
  PaymentIntent,
  AgentProposal,
  AgentPolicy,
  AgentReceipt,
  AgentIdentity,
  PolicyEvalResult,
  PolicyMiddleware,
} from './types.js';

// Proto-generated types (enums, serializable, language-agnostic)
export {
  IntentType,
  RiskLevel,
  ReceiptStatus,
} from './generated/totem/agent/policy/v1/agent_policy.js';

export type {
  PaymentIntent as ProtoPaymentIntent,
  AgentProposal as ProtoAgentProposal,
  AgentReceipt as ProtoAgentReceipt,
  AgentIdentity as ProtoAgentIdentity,
  AgentPolicyConfig,
} from './generated/totem/agent/policy/v1/agent_policy.js';

// Composable policy middleware
export { ComposablePolicy } from './composable.js';

// Built-in policy primitives
export { RateLimitPolicy } from './rate-limit.js';
export { AmountCapPolicy } from './amount-cap.js';
export type { AmountCapConfig } from './amount-cap.js';
export { RecipientAllowlistPolicy } from './recipient-allowlist.js';
export { TimeWindowPolicy } from './time-window.js';
export { RiskThresholdPolicy } from './risk-threshold.js';

// Authority bridge
export { AuthorityPolicy, defaultActionExtractor, intentAction } from './authority.js';
export type { AuthorityActionIntent, AuthorityDecisionResult, AuthorityEvaluator, AuthorityPolicyOptions } from './authority.js';

// Grant-bound autonomous run coordination
export { GrantBoundPolicy, resolveStepField } from './grant-bound.js';
export type { GrantBoundPolicyOptions, LocalBounds, AuthorizeStepResult } from './grant-bound.js';

export { MemoryGrantUsageStore } from './grant-usage.js';
export type { GrantUsageStore, MemoryGrantUsageStoreOptions } from './grant-usage.js';

// Run-level autonomy
export { GrantBoundAutonomyPolicy, accumulateAmount } from './grant-bound-autonomy.js';
export type {
  OpenRunParams,
  AuthorizeAndReserveParams,
  RunAuthorization,
  RunAuthorizationRejected,
  CommitParams,
  RunReceiptGraph,
  SuggestedGrantAmendment,
  GrantBoundAutonomyOptions,
} from './grant-bound-autonomy.js';

export { MemoryRunStateStore } from './run-state-store.js';
export type { RunStateStore, RunStateSnapshot, RunReservation, RunStepReceipt, RunSessionTotals } from './run-state-store.js';

export { SqliteRunStateStore } from './sqlite-run-state-store.js';
export type { SqliteRunStateStoreOptions } from './sqlite-run-state-store.js';

export { createAutonomyPolicy, checkRunLimits, checkTransition, checkObligations, evaluateGrantRequirement, isStartEligible } from './autonomy.js';
export type { AutonomyPolicy, BoundaryFailure, BoundaryEscalation } from './autonomy.js';

export { reduceToCanonicalAction, summarizeStepSpend } from './omnia-rebalance-slice.js';
export type { PreparedRebalanceOperation, PreparedStep } from './omnia-rebalance-slice.js';

export {
  canonicalAgentActionDigest,
} from './run.js';
export type {
  AutonomyMode,
  AutonomyProfile,
  GrantRequirement,
  RunLimits,
  RunObligations,
  StepTransitionRule,
  StepEffects,
  StepEffect,
  ChannelEffect,
  CanonicalAgentAction,
} from './run.js';

export type {
  AutonomousRun,
  AgentStep,
  ActionIntent as RunActionIntent,
  StepAuthorization,
  StepAuthorizationInput,
  StepReceipt,
  RunMode,
} from './run.js';

// Receipt persistence
export { MemoryReceiptStore } from './receipt-store.js';
export type { ReceiptStore } from './receipt-store.js';
