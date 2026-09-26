/**
 * @module @totemsdk/decision/types
 *
 * Provider-neutral decision contracts.
 *
 * A decision provider produces **proposals only** — it never authorizes,
 * executes, or holds keys. Consumers depend on these types; providers implement
 * them. The Totem invariant holds: **AI proposes, Totem authorizes.**
 *
 * Trust boundary (RFC-012 §4.3): providers return {@link DecisionProviderOutcome}
 * and can never supply runtime bindings, receipts, or attempt history. The
 * runtime returns {@link DecisionOutcome}.
 */

import type {
  DecisionCapability,
  DecisionType,
} from './constants.js';
import type {
  DecisionErrorCode,
  DecisionEscalationReason,
} from './errors.js';

// ── Canonical values ───────────────────────────────────────────────────────

/**
 * A canonical scalar. `NaN`, `±Infinity`, functions, symbols, cycles, and
 * ambiguous `undefined` are not valid decision values.
 */
export type DecisionScalar = string | number | boolean | null;

/**
 * A canonical, JSON-compatible decision value. Large binaries are never
 * embedded — they are referenced by digest/evidence id.
 */
export type DecisionValue =
  | DecisionScalar
  | readonly DecisionValue[]
  | { readonly [key: string]: DecisionValue };

// ── Observation ────────────────────────────────────────────────────────────

/**
 * Optional lightweight observation. This is not a sensor framework; specialist
 * models (intelligence) produce `DecisionValue`s.
 */
export interface DecisionObservation {
  readonly id: string;
  readonly kind: string;
  readonly value: DecisionValue;
  readonly confidence?: number;
  readonly evidenceId?: string;
  readonly model?: {
    readonly id?: string;
    readonly revision?: string;
    readonly digest?: string;
  };
  readonly observedAt?: number;
}

// ── Context ────────────────────────────────────────────────────────────────

/**
 * Trace/governance metadata. Must never contain key material.
 *
 * **Invariant (RFC-012 §11.3):** context MUST NOT affect provider semantics.
 * It does not participate in the request digest, and the runtime strips it
 * before invoking providers. Anything intended to influence the answer belongs
 * in `state`, `goal`, `instruction`, criterion metadata, or another
 * digest-bound semantic field.
 */
export interface DecisionContext {
  readonly agentId?: string;
  readonly proposalId?: string;
  readonly runId?: string;
  readonly principal?: string;
  readonly metadata?: Record<string, DecisionValue>;
}

// ── Criteria / candidates ──────────────────────────────────────────────────

/** A selectable criterion for choice/score questions. */
export interface DecisionCriterion {
  readonly id: string;
  readonly description?: string;
  readonly metadata?: DecisionValue;
}

/** An action target. */
export interface DecisionTarget {
  readonly id: string;
  readonly description?: string;
  readonly metadata?: DecisionValue;
}

/** An action operation, optionally bearing distinct targets. */
export interface DecisionOperation {
  readonly id: string;
  readonly description?: string;
  readonly metadata?: DecisionValue;
  readonly targets?: readonly DecisionTarget[];
}

// ── Questions ──────────────────────────────────────────────────────────────

export interface ChoiceQuestion {
  readonly type: 'choice';
  readonly id: string;
  readonly instruction?: string;
  readonly criteria: readonly DecisionCriterion[];
}

export interface ScoreQuestion {
  readonly type: 'score';
  readonly id: string;
  readonly instruction?: string;
  /** Order is increasing (lowest → highest). */
  readonly rubric: readonly DecisionCriterion[];
}

export interface ProbabilityQuestion {
  readonly type: 'probability';
  readonly id: string;
  readonly proposition: string;
}

export type DecisionQuestion =
  | ChoiceQuestion
  | ScoreQuestion
  | ProbabilityQuestion;

// ── Requests ───────────────────────────────────────────────────────────────

export interface QuestionDecisionRequest {
  readonly kind: 'questions';
  readonly requestId?: string;
  readonly state: DecisionValue;
  readonly questions: readonly DecisionQuestion[];
  readonly context?: DecisionContext;
  readonly signal?: AbortSignal;
}

export interface ActionDecisionRequest {
  readonly kind: 'action';
  readonly requestId?: string;
  readonly state: DecisionValue;
  readonly goal?: string;
  readonly operations: readonly DecisionOperation[];
  readonly context?: DecisionContext;
  readonly signal?: AbortSignal;
}

export type DecisionRequest = QuestionDecisionRequest | ActionDecisionRequest;

/**
 * Provider-facing request. Semantically complete, trace-free: no `context`,
 * no caller-owned tracing fields. `requestId` is runtime-issued so provider
 * cancels are always addressable.
 */
export type DecisionProviderRequest =
  | {
      readonly kind: 'questions';
      readonly requestId: string;
      readonly state: DecisionValue;
      readonly questions: readonly DecisionQuestion[];
      readonly signal?: AbortSignal;
    }
  | {
      readonly kind: 'action';
      readonly requestId: string;
      readonly state: DecisionValue;
      readonly goal?: string;
      readonly operations: readonly DecisionOperation[];
      readonly signal?: AbortSignal;
    };

// ── Confidence ─────────────────────────────────────────────────────────────

/**
 * Confidence annotation. Never present a provider `0.92` as "92% calibrated
 * correctness" — calibration is only asserted when the provider reports it.
 */
export interface DecisionConfidence {
  readonly value: number;
  readonly source: 'provider' | 'selected_probability' | 'derived';
  readonly calibrated?: boolean;
}

// ── Answers / results (frozen) ─────────────────────────────────────────────

export interface ChoiceAnswer {
  readonly type: 'choice';
  readonly questionId: string;
  readonly selected: string;
  /** Partial or complete distribution. Never padded or renormalized silently. */
  readonly probabilities?: Record<string, number>;
  /** When true, `probabilities` must cover the candidate set and sum ≈ 1. */
  readonly complete?: boolean;
  readonly confidence?: DecisionConfidence;
}

export interface ScoreAnswer {
  readonly type: 'score';
  readonly questionId: string;
  readonly selected: string;
  readonly distribution?: Record<string, number>;
  /** When true, `distribution` must cover the rubric and sum ≈ 1. */
  readonly complete?: boolean;
  /**
   * Zero-based expectation over rubric order:
   * `Σ index(criterion) · P(criterion)`.
   */
  readonly expectedScore?: number;
  readonly confidence?: DecisionConfidence;
}

export interface ProbabilityAnswer {
  readonly type: 'probability';
  readonly questionId: string;
  /** P(proposition). Not a manufactured boolean selection at 0.5. */
  readonly probabilityTrue: number;
  readonly confidence?: DecisionConfidence;
}

export type QuestionAnswer = ChoiceAnswer | ScoreAnswer | ProbabilityAnswer;

export interface QuestionDecisionResult {
  readonly kind: 'questions';
  readonly answers: readonly QuestionAnswer[];
}

export interface ActionAnswer {
  readonly type: 'action';
  readonly operation: string;
  /** Present only when a target-bearing operation was selected. */
  readonly target?: string;
  readonly operationProbabilities?: Record<string, number>;
  readonly targetProbabilities?: Record<string, number>;
  readonly confidence?: DecisionConfidence;
}

export interface ActionDecisionResult {
  readonly kind: 'action';
  readonly answer: ActionAnswer;
}

export type DecisionAnswer = QuestionAnswer | ActionAnswer;

export type DecisionResult = QuestionDecisionResult | ActionDecisionResult;

// ── Provenance ─────────────────────────────────────────────────────────────

export interface DecisionModelRef {
  readonly id?: string;
  readonly revision?: string;
  readonly digest?: string;
  /** `declared` is unverified caller input; never present it as fact. */
  readonly provenance?: 'declared' | 'provider-reported' | 'verified';
}

export interface DecisionRuntimeRef {
  readonly id?: string;
  readonly version?: string;
}

export type DecisionLocality = 'local' | 'remote' | 'hybrid' | 'unknown';

/**
 * Provider provenance. Missing fields are omitted, never invented. Caller
 * declarations are never presented as verified facts.
 */
export interface DecisionProvenance {
  readonly providerId: string;
  readonly providerVersion?: string;
  readonly model?: DecisionModelRef;
  readonly runtime?: DecisionRuntimeRef;
  readonly locality?: DecisionLocality;
  readonly upstreamRequestId?: string;
  readonly source?: 'declared' | 'provider-reported' | 'verified';
}

/** Provider-reported usage. Unit of consumption is provider-specific. */
export interface DecisionUsage {
  readonly durationMs?: number;
  readonly providerRequestId?: string;
  readonly metadata?: Record<string, number | string>;
}

// ── Provider outcome (untrusted) ───────────────────────────────────────────

/**
 * A provider's proposed decision. Contains **no** runtime bindings, receipt, or
 * attempt history — those are runtime constructs.
 */
export interface DecisionProviderSuccess<
  T = DecisionResult,
> {
  readonly ok: true;
  readonly requestId: string;
  readonly decision: T;
  readonly confidence?: DecisionConfidence;
  readonly usage?: DecisionUsage;
  readonly provenance?: DecisionProvenance;
  readonly upstreamRequestId?: string;
  /** Only populated when explicitly requested. */
  readonly rawProviderOutput?: unknown;
}

export interface DecisionProviderFailure {
  readonly ok: false;
  readonly requestId: string;
  readonly code: DecisionErrorCode;
  readonly message: string;
  readonly retryable: boolean;
}

/**
 * Provider outcome. `DecisionProviderOutcome<void>` is the control form used by
 * `cancel` (no proposed decision).
 */
export type DecisionProviderOutcome<T = DecisionResult> = [T] extends [void]
  ? { readonly ok: true; readonly requestId: string } | DecisionProviderFailure
  : DecisionProviderSuccess<T> | DecisionProviderFailure;

// ── Runtime status / provenance ────────────────────────────────────────────

export interface DecisionProviderRef {
  readonly id: string;
  readonly version: string;
}

/** One provider invocation, preserved for provenance. Never carries secrets. */
export interface DecisionAttempt {
  readonly providerId: string;
  readonly providerVersion?: string;
  readonly startedAt: number;
  readonly durationMs: number;
  readonly accepted: boolean;
  readonly reason?: DecisionEscalationReason;
  readonly confidence?: number;
  readonly errorCode?: DecisionErrorCode;
  /** When the route was skipped before invocation. */
  readonly skipped?: boolean;
  readonly message?: string;
}

/** Request-scoped bindings (available before a decision exists). */
export interface DecisionRequestBindings {
  readonly stateDigest: string;
  readonly candidateSetDigest: string;
  readonly requestDigest: string;
}

/** Full bindings, available once a decision exists. */
export interface DecisionBindings extends DecisionRequestBindings {
  readonly outputDigest: string;
}

// ── Runtime outcome (trusted) ──────────────────────────────────────────────

/** A decision success — a proposal, never an authorization. */
export interface DecisionSuccess<
  T = DecisionResult,
> {
  readonly ok: true;
  readonly requestId: string;
  readonly decision: T;
  readonly provider: DecisionProviderRef;
  readonly bindings: DecisionBindings;
  readonly receipt: DecisionReceipt;
  readonly attempts: readonly DecisionAttempt[];
  readonly usage?: DecisionUsage;
  /** Aggregate confidence (min across answers when batched). `undefined` if unknown. */
  readonly confidence?: number;
  /** Raw provider output, only when `includeRawProviderOutput` is enabled. */
  readonly rawProviderOutput?: unknown;
}

/** A decision failure — terminal, non-throwing at the runtime boundary. */
export interface DecisionFailure {
  readonly ok: false;
  readonly requestId: string;
  readonly code: DecisionErrorCode;
  readonly message: string;
  readonly attempts: readonly DecisionAttempt[];
  readonly bindings?: DecisionRequestBindings;
}

export type DecisionOutcome<T = DecisionResult> =
  | DecisionSuccess<T>
  | DecisionFailure;

// ── Receipts ───────────────────────────────────────────────────────────────

/**
 * Unsigned advisory decision receipt (v1).
 *
 * `hashes ≠ proof of neural correctness`
 * `DecisionReceipt ≠ cryptographic authorization ≠ signed attestation`
 */
export interface DecisionReceipt {
  readonly version: 1;
  readonly receiptId: string;
  readonly requestId: string;
  readonly provider: DecisionProviderRef;
  readonly model?: DecisionModelRef;
  readonly runtime?: DecisionRuntimeRef;
  readonly stateDigest: string;
  readonly candidateSetDigest: string;
  readonly requestDigest: string;
  readonly outputDigest: string;
  readonly decisionKind: 'questions' | 'action';
  readonly issuedAt: number;
  readonly durationMs?: number;
  readonly confidence?: number;
}

/** Receipt body (everything except `receiptId`) used to derive `receiptId`. */
export type DecisionReceiptBody = Omit<DecisionReceipt, 'receiptId'>;

// ── Provider metadata ──────────────────────────────────────────────────────

/**
 * Structural provenance. Aids routing; grants nothing. Missing fields are
 * omitted, never invented.
 */
export interface DecisionProviderInfo {
  readonly locality?: DecisionLocality;
  readonly maxQuestions?: number;
  readonly maxCandidatesPerQuestion?: number;
  readonly maxOperations?: number;
  readonly maxTargetsPerOperation?: number;
  readonly maxStateBytes?: number;
  readonly supportedTypes?: readonly DecisionType[];
  readonly runtime?: DecisionRuntimeRef;
  readonly model?: DecisionModelRef;
}

// ── Provider contract ──────────────────────────────────────────────────────

/**
 * Provider-neutral decision interface.
 *
 * Implementors are compute-only: they cannot sign, move value, or hold private
 * keys. `decide` returns a proposal subject to runtime validation; providers
 * cannot supply bindings, receipts, or attempts.
 */
export interface DecisionProvider {
  readonly id: string;
  readonly displayName: string;
  readonly version: string;
  readonly capabilities: readonly DecisionCapability[];
  readonly isReady: boolean;
  readonly info?: DecisionProviderInfo;
  decide(request: DecisionProviderRequest): Promise<DecisionProviderOutcome>;
  cancel?(requestId: string): Promise<DecisionProviderOutcome<void>>;
  close?(): Promise<void>;
}

// ── Acceptance ─────────────────────────────────────────────────────────────

export interface DecisionAcceptanceContext {
  readonly request: DecisionProviderRequest;
  readonly provider: DecisionProvider;
  readonly decision: DecisionResult;
  readonly confidence?: number;
}

export interface DecisionAcceptanceEvaluation {
  readonly accepted: boolean;
  readonly reason?: DecisionEscalationReason;
  readonly confidence?: number;
}

/**
 * Built-in acceptance rules. Acceptance answers only "is this good enough to
 * become the `DecisionResult`?" — never "may this happen?".
 */
export interface DecisionAcceptanceRule {
  /** Every answer (batched) must meet the threshold. */
  readonly minConfidence?: number;
  /** Selected candidate probability must meet the threshold. */
  readonly minSelectedProbability?: number;
  /** Require an explicit distribution on choice questions. */
  readonly requireProbabilities?: boolean;
  /**
   * Maximum **normalized** Shannon entropy in `[0,1]`. Applies only when the
   * distribution is complete.
   */
  readonly maxEntropy?: number;
  /** Action: minimum operation confidence. */
  readonly minOperationConfidence?: number;
  /** Action: minimum target confidence (ignored when no target is required). */
  readonly minTargetConfidence?: number;
  /** Custom predicate. Returns boolean or a full evaluation. */
  readonly predicate?: (
    context: DecisionAcceptanceContext,
  ) => boolean | DecisionAcceptanceEvaluation;
}

// ── Routing ────────────────────────────────────────────────────────────────

export interface DecisionRoute {
  /** A provider instance, or a provider id resolving into `providers`. */
  readonly provider: DecisionProvider | string;
  /** Restrict this route to specific decision types. */
  readonly types?: readonly DecisionType[];
  readonly accept?: DecisionAcceptanceRule;
  readonly timeoutMs?: number;
  readonly maxQuestions?: number;
  readonly maxCandidatesPerQuestion?: number;
  readonly maxOperations?: number;
  readonly maxTargetsPerOperation?: number;
  readonly maxStateBytes?: number;
  /**
   * Escalate to the next route after a **route timeout**. Defaults to `true`.
   * Caller cancellation is always terminal and never escalates (RFC-012 §27).
   */
  readonly escalateOnTimeout?: boolean;
}

/** Optional candidate shortlister. Deterministic by contract. Deferred v1. */
export interface DecisionShortlister {
  shortlist(params: {
    request: DecisionProviderRequest;
    provider: DecisionProvider;
  }): DecisionProviderRequest | Promise<DecisionProviderRequest>;
}

export interface DecisionRuntimeOptions {
  readonly routes: readonly DecisionRoute[];
  readonly providers?: Record<string, DecisionProvider>;
  readonly shortlister?: DecisionShortlister;
  readonly onReceipt?: (receipt: DecisionReceipt) => void;
  readonly onAttempt?: (attempt: DecisionAttempt) => void;
  readonly now?: () => number;
  readonly defaultTimeoutMs?: number;
  /** Raw provider output is omitted by default. */
  readonly includeRawProviderOutput?: boolean;
  /** Generate a `requestId` when the request omits one. Defaults to true. */
  readonly generateRequestId?: boolean;
}

// ── Runtime / port ─────────────────────────────────────────────────────────

export interface DecisionRuntime {
  decide(request: DecisionRequest): Promise<DecisionOutcome>;
  cancel?(requestId: string): Promise<DecisionProviderOutcome<void>>;
  close?(): Promise<void>;
}

/** Port-facing result shape; mirrors @totemsdk/edge's `EdgeOperationResult`. */
export interface DecisionPortResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

/**
 * Edge-compatible decision port contract.
 *
 * Lives in @totemsdk/decision (not @totemsdk/edge) so the composition seam does
 * not create an edge dependency. @totemsdk/edge re-exports this type and hosts
 * implementations via `EdgeRuntimePorts.decision`.
 */
export interface EdgeDecisionPort {
  /** Stable runtime/provider id (e.g. 'decision'). */
  readonly runtimeId: string;
  /** Capability strings advertised (e.g. ['decision:choice', …]). */
  readonly capabilities: readonly DecisionCapability[];
  decide(params: { request: DecisionRequest }): Promise<DecisionPortResult>;
  cancel?(requestId: string): Promise<DecisionPortResult>;
  close?(): Promise<void>;
}

// ── Typed backend seam ─────────────────────────────────────────────────────

/** A backend question in canonical form (provider peculiarities already removed). */
export interface TypedBackendQuestion {
  readonly id: string;
  readonly type: DecisionType;
  readonly candidates?: readonly string[];
  /** Ordered increasing. */
  readonly rubric?: readonly string[];
  readonly proposition?: string;
  readonly operations?: readonly {
    readonly id: string;
    readonly targets?: readonly string[];
  }[];
}

export interface TypedBackendPrediction {
  readonly type: DecisionType;
  readonly selected?: string;
  readonly probabilities?: Record<string, number>;
  readonly complete?: boolean;
  readonly distribution?: Record<string, number>;
  readonly expectedScore?: number;
  readonly probabilityTrue?: number;
  readonly operation?: string;
  readonly target?: string;
  /** One target head per operation key. Only the selected operation's head is used. */
  readonly targetHeads?: Record<string, { readonly target: string; readonly probability?: number }>;
  readonly operationProbabilities?: Record<string, number>;
  readonly targetProbabilities?: Record<string, number>;
  readonly confidence?: number;
  readonly calibrated?: boolean;
}

export interface TypedBackendResult {
  readonly predictions: Record<string, TypedBackendPrediction>;
  readonly usage?: DecisionUsage;
  readonly upstreamRequestId?: string;
  readonly raw?: unknown;
}

/**
 * Shared typed-decision backend seam. Provider adapters translate backend
 * peculiarities; the shared translation implements the four semantics.
 */
export interface TypedDecisionBackend {
  readonly id: string;
  readonly version?: string;
  predict(params: {
    state: DecisionValue;
    questions: Record<string, TypedBackendQuestion>;
    signal?: AbortSignal;
  }): Promise<TypedBackendResult>;
}

export type {
  DecisionCapability,
  KnownDecisionCapability,
  DecisionType,
} from './constants.js';
