/**
 * @module @totemsdk/decision/validation
 *
 * Request validation, candidate-constrained provider-output validation, and
 * distribution validation. All failures are `DecisionError`s.
 */

import { DECISION_DEFAULTS, type DecisionCapability, type DecisionType } from './constants.js';
import { DecisionError } from './errors.js';
import { assertDecisionValue, stateByteLength } from './canonical.js';
import type {
  ActionAnswer,
  ActionDecisionResult,
  ActionDecisionRequest,
  ChoiceAnswer,
  DecisionConfidence,
  DecisionOperation,
  DecisionProviderRequest,
  DecisionRequest,
  DecisionResult,
  DecisionTarget,
  ProbabilityAnswer,
  QuestionDecisionResult,
  QuestionDecisionRequest,
  ScoreAnswer,
} from './types.js';

export interface DecisionLimits {
  readonly maxQuestions?: number;
  readonly maxCandidatesPerQuestion?: number;
  readonly maxOperations?: number;
  readonly maxTargetsPerOperation?: number;
  readonly maxStateBytes?: number;
}

const DEFAULT_LIMITS: Required<DecisionLimits> = {
  maxQuestions: DECISION_DEFAULTS.maxQuestions,
  maxCandidatesPerQuestion: DECISION_DEFAULTS.maxCandidatesPerQuestion,
  maxOperations: DECISION_DEFAULTS.maxOperations,
  maxTargetsPerOperation: DECISION_DEFAULTS.maxTargetsPerOperation,
  maxStateBytes: DECISION_DEFAULTS.maxStateBytes,
};

function assertUnique(ids: readonly string[], what: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new DecisionError('DUPLICATE_CANDIDATE', `Duplicate ${what} id: ${id}.`);
    }
    seen.add(id);
  }
}

/**
 * Validate a caller request. Throws on malformed shape, duplicate/missing IDs,
 * empty candidate sets, or limit violations.
 */
export function validateDecisionRequest(
  request: DecisionRequest,
  limits: DecisionLimits = {},
): void {
  const l = { ...DEFAULT_LIMITS, ...stripUndefined(limits) };
  assertDecisionValue(request.state, '$.state');

  if (stateByteLength(request.state) > l.maxStateBytes) {
    throw new DecisionError('LIMIT_EXCEEDED', `State exceeds maxStateBytes (${l.maxStateBytes}).`);
  }
  if (request.requestId !== undefined && typeof request.requestId !== 'string') {
    throw new DecisionError('INVALID_REQUEST', 'requestId must be a string.');
  }

  if (request.kind === 'action') {
    if (!Array.isArray(request.operations) || request.operations.length === 0) {
      throw new DecisionError('EMPTY_CANDIDATE_SET', 'Action request offered no operations.');
    }
    if (request.operations.length > l.maxOperations) {
      throw new DecisionError('LIMIT_EXCEEDED', `Operations exceed maxOperations (${l.maxOperations}).`);
    }
    assertUnique(request.operations.map((o) => o.id), 'operation');
    for (const op of request.operations) {
      const targets = op.targets ?? [];
      if (targets.length > l.maxTargetsPerOperation) {
        throw new DecisionError(
          'LIMIT_EXCEEDED',
          `Targets for operation "${op.id}" exceed maxTargetsPerOperation (${l.maxTargetsPerOperation}).`,
        );
      }
      assertUnique(targets.map((t: DecisionTarget) => t.id), 'target');
    }
    return;
  }

  if (!Array.isArray(request.questions) || request.questions.length === 0) {
    throw new DecisionError('EMPTY_CANDIDATE_SET', 'Questions request offered no questions.');
  }
  if (request.questions.length > l.maxQuestions) {
    throw new DecisionError('LIMIT_EXCEEDED', `Questions exceed maxQuestions (${l.maxQuestions}).`);
  }
  assertUnique(request.questions.map((q) => q.id), 'question');

  for (const q of request.questions) {
    if (q.type === 'probability') {
      if (typeof q.proposition !== 'string' || q.proposition.length === 0) {
        throw new DecisionError('INVALID_REQUEST', `Probability question "${q.id}" needs a proposition.`);
      }
      continue;
    }
    const candidates = q.type === 'score' ? q.rubric : q.criteria;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      throw new DecisionError('EMPTY_CANDIDATE_SET', `Question "${q.id}" offered no candidates.`);
    }
    if (candidates.length > l.maxCandidatesPerQuestion) {
      throw new DecisionError(
        'LIMIT_EXCEEDED',
        `Question "${q.id}" exceeds maxCandidatesPerQuestion (${l.maxCandidatesPerQuestion}).`,
      );
    }
    assertUnique(candidates.map((c) => c.id), 'criterion');
  }
}

/** Decision types exercised by a request, de-duplicated in encounter order. */
export function deriveRequestedTypes(request: DecisionRequest): DecisionType[] {
  if (request.kind === 'action') return ['action'];
  const out: DecisionType[] = [];
  for (const q of request.questions) {
    if (!out.includes(q.type)) out.push(q.type);
  }
  return out;
}

/** Required capabilities = union of the request's decision types, de-duplicated. */
export function deriveRequiredCapabilities(request: DecisionRequest): DecisionCapability[] {
  return deriveRequestedTypes(request).map((t) => `decision:${t}` as DecisionCapability);
}

// ── Distribution validation ────────────────────────────────────────────────

export interface DistributionValidationOptions {
  readonly candidateIds: readonly string[];
  readonly selected?: string;
  readonly requireComplete?: boolean;
  readonly tolerance?: number;
}

/**
 * Validate a probability distribution. Complete distributions must cover the
 * candidate set and sum ≈ 1; partial distributions must be a subset. Partial
 * values are never padded or renormalized.
 */
export function validateDistribution(
  distribution: Record<string, number>,
  options: DistributionValidationOptions,
): void {
  const tolerance = options.tolerance ?? DECISION_DEFAULTS.distributionTolerance;
  const allowed = new Set(options.candidateIds);
  let sum = 0;
  let count = 0;

  for (const [key, value] of Object.entries(distribution)) {
    if (!allowed.has(key)) {
      throw new DecisionError('INVALID_CANDIDATE', `Distribution key "${key}" is not a valid candidate.`);
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new DecisionError('NON_FINITE_NUMBER', `Distribution value for "${key}" is not finite.`);
    }
    if (value < 0 || value > 1) {
      throw new DecisionError('INVALID_DISTRIBUTION', `Probability for "${key}" is outside [0,1].`);
    }
    sum += value;
    count += 1;
  }

  const complete = options.requireComplete === true;
  if (complete) {
    if (count !== allowed.size) {
      throw new DecisionError('INVALID_DISTRIBUTION', 'Complete distribution does not cover every candidate.');
    }
    if (Math.abs(sum - 1) > tolerance) {
      throw new DecisionError('INVALID_DISTRIBUTION', `Complete distribution sums to ${sum}, not ≈ 1.`);
    }
  }
  if (options.selected !== undefined && !allowed.has(options.selected)) {
    throw new DecisionError('INVALID_CANDIDATE', `Selected candidate "${options.selected}" is not valid.`);
  }
}

/** Normalized Shannon entropy in [0,1] for a complete distribution. */
export function normalizedEntropy(distribution: Record<string, number>): number {
  const values = Object.values(distribution).filter((p) => p > 0);
  const n = Object.keys(distribution).length;
  if (n <= 1) return 0;
  let h = 0;
  for (const p of values) h -= p * Math.log(p);
  return h / Math.log(n);
}

// ── Provider-output validation / normalization ─────────────────────────────

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
}

function normalizeConfidence(raw: unknown): DecisionConfidence | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 0 || raw > 1) {
      throw new DecisionError('INVALID_OUTPUT', 'Answer confidence must be finite in [0,1].');
    }
    return { value: raw, source: 'provider' };
  }
  if (isPlainObject(raw) && typeof raw.value === 'number') {
    if (!Number.isFinite(raw.value) || raw.value < 0 || raw.value > 1) {
      throw new DecisionError('INVALID_OUTPUT', 'Answer confidence must be finite in [0,1].');
    }
    const source = raw.source;
    return {
      value: raw.value,
      source:
        source === 'provider' || source === 'selected_probability' || source === 'derived'
          ? source
          : 'provider',
      calibrated: typeof raw.calibrated === 'boolean' ? raw.calibrated : undefined,
    };
  }
  throw new DecisionError('INVALID_OUTPUT', 'Malformed confidence annotation.');
}

function normalizeNumberMap(raw: unknown, what: string): Record<string, number> | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isPlainObject(raw)) {
    throw new DecisionError('INVALID_OUTPUT', `${what} must be an object.`);
  }
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new DecisionError('NON_FINITE_NUMBER', `${what}["${k}"] is not finite.`);
    }
    out[k] = v;
  }
  return out;
}

function candidateIdsOf(q: { type: string; criteria?: readonly { id: string }[]; rubric?: readonly { id: string }[] }): string[] {
  return (q.criteria ?? q.rubric ?? []).map((c) => c.id);
}

/**
 * Validate and normalize a provider-proposed decision against the offered
 * candidate space. Returns a clean canonical {@link DecisionResult}; unknown
 * fields are dropped. Providers cannot invent IDs or malformed distributions.
 *
 * @throws {DecisionError} `INVALID_OUTPUT` | `INVALID_CANDIDATE` | `INVALID_DISTRIBUTION`
 */
export function validateProviderDecision(
  providerRequest: DecisionProviderRequest,
  decision: unknown,
): DecisionResult {
  if (!isPlainObject(decision)) {
    throw new DecisionError('INVALID_OUTPUT', 'Provider decision must be an object.');
  }
  if (decision.kind !== providerRequest.kind) {
    throw new DecisionError('INVALID_OUTPUT', `Provider decision kind "${String(decision.kind)}" does not match request.`);
  }

  if (providerRequest.kind === 'questions') {
    if (!Array.isArray(decision.answers)) {
      throw new DecisionError('INVALID_OUTPUT', 'Provider questions decision must include answers[].');
    }
    return validateQuestionAnswers(providerRequest, decision.answers);
  }

  if (!isPlainObject(decision.answer)) {
    throw new DecisionError('INVALID_OUTPUT', 'Provider action decision must include answer.');
  }
  return validateActionAnswer(providerRequest, decision.answer);
}

function validateQuestionAnswers(
  request: QuestionDecisionRequest | Extract<DecisionProviderRequest, { kind: 'questions' }>,
  rawAnswers: readonly unknown[],
): QuestionDecisionResult {
  const byId = new Map(request.questions.map((q) => [q.id, q]));
  if (rawAnswers.length !== request.questions.length) {
    throw new DecisionError('INVALID_OUTPUT', 'Provider must answer every question exactly once.');
  }
  const seen = new Set<string>();
  const answers: (ChoiceAnswer | ScoreAnswer | ProbabilityAnswer)[] = [];

  for (const raw of rawAnswers) {
    if (!isPlainObject(raw) || typeof raw.questionId !== 'string') {
      throw new DecisionError('INVALID_OUTPUT', 'Malformed answer: missing questionId.');
    }
    const questionId = raw.questionId;
    const question = byId.get(questionId);
    if (!question) {
      throw new DecisionError('INVALID_CANDIDATE', `Answer references unknown question "${questionId}".`);
    }
    if (seen.has(questionId)) {
      throw new DecisionError('DUPLICATE_CANDIDATE', `Question "${questionId}" answered more than once.`);
    }
    seen.add(questionId);

    if (raw.type !== question.type) {
      throw new DecisionError('INVALID_OUTPUT', `Answer type "${String(raw.type)}" does not match question "${questionId}" type "${question.type}".`);
    }

    const confidence = normalizeConfidence(raw.confidence);

    if (question.type === 'choice') {
      const ids = candidateIdsOf(question);
      if (typeof raw.selected !== 'string' || !ids.includes(raw.selected)) {
        throw new DecisionError('INVALID_CANDIDATE', `Choice selected "${String(raw.selected)}" is not an offered candidate.`);
      }
      const probabilities = normalizeNumberMap(raw.probabilities, 'probabilities');
      if (probabilities) {
        validateDistribution(probabilities, {
          candidateIds: ids,
          selected: raw.selected,
          requireComplete: raw.complete === true || undefined,
        });
      }
      answers.push({
        type: 'choice',
        questionId,
        selected: raw.selected,
        ...(probabilities ? { probabilities } : {}),
        ...(typeof raw.complete === 'boolean' ? { complete: raw.complete } : {}),
        ...(confidence ? { confidence } : {}),
      });
      continue;
    }

    if (question.type === 'score') {
      const ids = candidateIdsOf(question);
      if (typeof raw.selected !== 'string' || !ids.includes(raw.selected)) {
        throw new DecisionError('INVALID_CANDIDATE', `Score selected "${String(raw.selected)}" is not on the rubric.`);
      }
      const distribution = normalizeNumberMap(raw.distribution, 'distribution');
      if (distribution) {
        validateDistribution(distribution, {
          candidateIds: ids,
          selected: raw.selected,
          requireComplete: raw.complete === true || undefined,
        });
      }
      let expectedScore: number | undefined;
      if (raw.expectedScore !== undefined && raw.expectedScore !== null) {
        if (typeof raw.expectedScore !== 'number' || !Number.isFinite(raw.expectedScore)) {
          throw new DecisionError('NON_FINITE_NUMBER', 'expectedScore is not finite.');
        }
        if (raw.expectedScore < 0 || raw.expectedScore > Math.max(ids.length - 1, 0)) {
          throw new DecisionError('INVALID_OUTPUT', 'expectedScore is outside the zero-based rubric range.');
        }
        expectedScore = raw.expectedScore;
      }
      answers.push({
        type: 'score',
        questionId,
        selected: raw.selected,
        ...(distribution ? { distribution } : {}),
        ...(typeof raw.complete === 'boolean' ? { complete: raw.complete } : {}),
        ...(expectedScore !== undefined ? { expectedScore } : {}),
        ...(confidence ? { confidence } : {}),
      });
      continue;
    }

    // probability
    if (typeof raw.probabilityTrue !== 'number' || !Number.isFinite(raw.probabilityTrue)) {
      throw new DecisionError('NON_FINITE_NUMBER', `probabilityTrue for "${questionId}" is not finite.`);
    }
    if (raw.probabilityTrue < 0 || raw.probabilityTrue > 1) {
      throw new DecisionError('INVALID_OUTPUT', `probabilityTrue for "${questionId}" is outside [0,1].`);
    }
    answers.push({
      type: 'probability',
      questionId,
      probabilityTrue: raw.probabilityTrue,
      ...(confidence ? { confidence } : {}),
    });
  }

  return { kind: 'questions', answers };
}

function validateActionAnswer(
  request: Extract<DecisionProviderRequest, { kind: 'action' }>,
  raw: Record<string, unknown>,
): ActionDecisionResult {
  const operations: readonly DecisionOperation[] = request.operations;
  const operationIds = operations.map((o) => o.id);
  if (typeof raw.operation !== 'string' || !operationIds.includes(raw.operation)) {
    throw new DecisionError('INVALID_CANDIDATE', `Operation "${String(raw.operation)}" was not offered.`);
  }
  const operation = operations.find((o) => o.id === raw.operation) as DecisionOperation;
  const targets: readonly DecisionTarget[] = operation.targets ?? [];
  const targetIds = targets.map((t) => t.id);

  let target: string | undefined;
  if (raw.target !== undefined && raw.target !== null) {
    if (typeof raw.target !== 'string') {
      throw new DecisionError('INVALID_OUTPUT', 'Action target must be a string.');
    }
    if (targetIds.length === 0) {
      throw new DecisionError('INVALID_CANDIDATE', `Operation "${operation.id}" has no targets.`);
    }
    if (!targetIds.includes(raw.target)) {
      throw new DecisionError('INVALID_CANDIDATE', `Target "${raw.target}" is not compatible with operation "${operation.id}".`);
    }
    target = raw.target;
  }

  const operationProbabilities = normalizeNumberMap(raw.operationProbabilities, 'operationProbabilities');
  if (operationProbabilities) {
    validateDistribution(operationProbabilities, { candidateIds: operationIds });
  }

  const targetProbabilities = normalizeNumberMap(raw.targetProbabilities, 'targetProbabilities');
  if (targetProbabilities) {
    if (targetIds.length === 0) {
      throw new DecisionError('INVALID_CANDIDATE', `targetProbabilities supplied for targetless operation "${operation.id}".`);
    }
    validateDistribution(targetProbabilities, { candidateIds: targetIds, selected: target });
  }

  const confidence = normalizeConfidence(raw.confidence);

  const answer: ActionAnswer = {
    type: 'action',
    operation: raw.operation,
    ...(target !== undefined ? { target } : {}),
    ...(operationProbabilities ? { operationProbabilities } : {}),
    ...(targetProbabilities ? { targetProbabilities } : {}),
    ...(confidence ? { confidence } : {}),
  };
  return { kind: 'action', answer };
}

function stripUndefined<T extends object>(value: T): T {
  const out = {} as Record<string, unknown>;
  for (const [k, v] of Object.entries(value)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

export type { ActionDecisionRequest };
