/**
 * @module @totemsdk/decision
 *
 * Provider-neutral decision runtime — typed, constrained, provenance-bound
 * proposals over dynamic candidate spaces.
 *
 * A decision provider produces proposals only: it never authorizes, executes,
 * or holds keys. The Totem invariant holds — **AI proposes, Totem authorizes.**
 */

export {
  DECISION_VERSION,
  DECISION_TYPES,
  DECISION_CAPABILITIES,
  DECISION_VERBS,
  DECISION_DIGEST_DOMAINS,
  DECISION_DEFAULTS,
  isDecisionCapability,
  hasDecisionCapability,
  decisionCapabilityForType,
} from './constants.js';
export type {
  DecisionType,
  DecisionCapability,
  KnownDecisionCapability,
  DecisionDigestDomain,
} from './constants.js';

export {
  DecisionError,
  DECISION_ERROR_MESSAGES,
} from './errors.js';
export type {
  DecisionErrorCode,
  DecisionEscalationReason,
} from './errors.js';

export type {
  DecisionScalar,
  DecisionValue,
  DecisionObservation,
  DecisionContext,
  DecisionCriterion,
  DecisionTarget,
  DecisionOperation,
  DecisionQuestion,
  ChoiceQuestion,
  ScoreQuestion,
  ProbabilityQuestion,
  QuestionDecisionRequest,
  ActionDecisionRequest,
  DecisionRequest,
  DecisionProviderRequest,
  DecisionConfidence,
  ChoiceAnswer,
  ScoreAnswer,
  ProbabilityAnswer,
  QuestionAnswer,
  DecisionAnswer,
  QuestionDecisionResult,
  ActionAnswer,
  ActionDecisionResult,
  DecisionResult,
  DecisionModelRef,
  DecisionRuntimeRef,
  DecisionLocality,
  DecisionProvenance,
  DecisionUsage,
  DecisionProviderSuccess,
  DecisionProviderFailure,
  DecisionProviderOutcome,
  DecisionProviderRef,
  DecisionAttempt,
  DecisionRequestBindings,
  DecisionBindings,
  DecisionSuccess,
  DecisionFailure,
  DecisionOutcome,
  DecisionReceipt,
  DecisionReceiptBody,
  DecisionProviderInfo,
  DecisionProvider,
  DecisionAcceptanceContext,
  DecisionAcceptanceEvaluation,
  DecisionAcceptanceRule,
  DecisionRoute,
  DecisionShortlister,
  DecisionRuntimeOptions,
  DecisionRuntime,
  DecisionPortResult,
  EdgeDecisionPort,
  TypedBackendQuestion,
  TypedBackendPrediction,
  TypedBackendResult,
  TypedDecisionBackend,
} from './types.js';

export {
  assertDecisionValue,
  isDecisionValue,
  computeStateDigest,
  computeCandidateSetDigest,
  computeDecisionBindings,
  computeOutputDigest,
  stateByteLength,
  canonicalDecisionJson,
  isDecisionFresh,
  assertDecisionFresh,
} from './canonical.js';

export {
  validateDecisionRequest,
  validateProviderDecision,
  validateDistribution,
  normalizedEntropy,
  deriveRequestedTypes,
  deriveRequiredCapabilities,
} from './validation.js';
export type { DecisionLimits, DistributionValidationOptions } from './validation.js';

export {
  computeReceiptId,
  createDecisionReceipt,
  verifyDecisionReceiptId,
} from './receipts.js';

export {
  aggregateConfidence,
  evaluateAcceptance,
} from './acceptance.js';

export {
  createTypedDecisionProvider,
  createClientDecisionProvider,
  ALL_DECISION_CAPABILITIES,
} from './typed-backend.js';
export type {
  TypedDecisionProviderOptions,
  ClientDecisionProviderOptions,
  DecisionClientLike,
  DecisionClientQuestion,
  DecisionClientPrediction,
  DecisionClientResult,
} from './typed-backend.js';

export { createDecisionRuntime } from './runtime.js';

export {
  createEdgeDecisionPort,
} from './port.js';
export type { CreateEdgeDecisionPortOptions } from './port.js';
