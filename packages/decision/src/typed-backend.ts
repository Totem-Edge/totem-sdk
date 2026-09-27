/**
 * @module @totemsdk/decision/typed-backend
 *
 * The shared translation seam. A {@link TypedDecisionBackend} is a thin,
 * backend-specific predictor; this module turns it into a provider-neutral
 * {@link DecisionProvider}. Backend peculiarities never escape the adapter, and
 * all translated output is still re-validated by the runtime.
 */

import {
  DECISION_TYPES,
  type DecisionCapability,
} from './constants.js';
import { aggregateConfidence } from './acceptance.js';
import type {
  ActionAnswer,
  DecisionConfidence,
  DecisionProvider,
  DecisionProviderInfo,
  DecisionProviderOutcome,
  DecisionProviderRequest,
  DecisionResult,
  DecisionUsage,
  DecisionValue,
  TypedBackendCandidate,
  TypedBackendOperation,
  TypedBackendPrediction,
  TypedBackendQuestion,
  TypedDecisionBackend,
} from './types.js';

export interface TypedDecisionProviderOptions {
  readonly backend: TypedDecisionBackend;
  readonly id: string;
  readonly displayName?: string;
  readonly version?: string;
  readonly capabilities?: readonly DecisionCapability[];
  readonly isReady?: boolean;
  readonly info?: DecisionProviderInfo;
}

/** All four canonical capabilities. */
export const ALL_DECISION_CAPABILITIES: readonly DecisionCapability[] =
  DECISION_TYPES.map((t) => `decision:${t}` as DecisionCapability);

function buildBackendQuestions(request: DecisionProviderRequest): {
  questions: Record<string, TypedBackendQuestion>;
} {
  const questions: Record<string, TypedBackendQuestion> = {};
  if (request.kind === 'questions') {
    for (const q of request.questions) {
      if (q.type === 'probability') {
        questions[q.id] = { id: q.id, type: 'probability', proposition: q.proposition };
      } else if (q.type === 'score') {
        questions[q.id] = {
          id: q.id,
          type: 'score',
          ...(q.instruction !== undefined ? { instruction: q.instruction } : {}),
          rubric: q.rubric.map((c) => ({ id: c.id, description: c.description, metadata: c.metadata })),
        };
      } else {
        questions[q.id] = {
          id: q.id,
          type: 'choice',
          ...(q.instruction !== undefined ? { instruction: q.instruction } : {}),
          candidates: q.criteria.map((c) => ({ id: c.id, description: c.description, metadata: c.metadata })),
        };
      }
    }
    return { questions };
  }
  // RFC-012 §24: retain the goal, operation/target descriptions and metadata so
  // the adapter can format a semantically complete provider request.
  questions.__action = {
    id: '__action',
    type: 'action',
    action: {
      ...(request.goal !== undefined ? { goal: request.goal } : {}),
      operations: request.operations.map((op) => ({
        id: op.id,
        description: op.description,
        metadata: op.metadata,
        targets: (op.targets ?? []).map((t) => ({ id: t.id, description: t.description, metadata: t.metadata })),
      })),
    },
  };
  return { questions };
}

function predictionConfidence(
  prediction: TypedBackendPrediction | undefined,
): { value: number; calibrated?: boolean } | undefined {
  if (!prediction || typeof prediction.confidence !== 'number') return undefined;
  if (!Number.isFinite(prediction.confidence)) return undefined;
  return { value: prediction.confidence, ...(prediction.calibrated !== undefined ? { calibrated: prediction.calibrated } : {}) };
}

function toDecisionConfidence(
  c: { value: number; calibrated?: boolean } | undefined,
): DecisionConfidence | undefined {
  if (!c) return undefined;
  return { value: c.value, source: 'provider', ...(c.calibrated !== undefined ? { calibrated: c.calibrated } : {}) };
}

/** Translate backend predictions into a canonical (untrusted) decision result. */
export function translateBackendResult(
  request: DecisionProviderRequest,
  predictions: Record<string, TypedBackendPrediction>,
): DecisionResult {
  if (request.kind === 'questions') {
    const answers = request.questions.map((q) => {
      const p = predictions[q.id];
      if (!p) {
        throw new Error(`Backend produced no prediction for question "${q.id}".`);
      }
      const conf = predictionConfidence(p);
      if (q.type === 'choice') {
        return {
          type: 'choice' as const,
          questionId: q.id,
          selected: p.selected ?? '',
          ...(p.probabilities ? { probabilities: p.probabilities } : {}),
          ...(typeof p.complete === 'boolean' ? { complete: p.complete } : {}),
          ...(conf ? { confidence: { value: conf.value, source: 'provider' as const, ...(conf.calibrated !== undefined ? { calibrated: conf.calibrated } : {}) } } : {}),
        };
      }
      if (q.type === 'score') {
        return {
          type: 'score' as const,
          questionId: q.id,
          selected: p.selected ?? '',
          ...(p.distribution ? { distribution: p.distribution } : {}),
          ...(typeof p.complete === 'boolean' ? { complete: p.complete } : {}),
          ...(p.expectedScore !== undefined ? { expectedScore: p.expectedScore } : {}),
          ...(conf ? { confidence: { value: conf.value, source: 'provider' as const, ...(conf.calibrated !== undefined ? { calibrated: conf.calibrated } : {}) } } : {}),
        };
      }
      return {
        type: 'probability' as const,
        questionId: q.id,
        probabilityTrue: p.probabilityTrue ?? 0,
        ...(conf ? { confidence: { value: conf.value, source: 'provider' as const, ...(conf.calibrated !== undefined ? { calibrated: conf.calibrated } : {}) } } : {}),
      };
    });
    return { kind: 'questions', answers };
  }

  const p = predictions.__action ?? predictions.action ?? Object.values(predictions)[0];
  const selectedOperation = p?.operation ?? '';
  const operation = request.operations.find((op) => op.id === selectedOperation);
  const targetIds = (operation?.targets ?? []).map((t) => t.id);

  // Only the selected operation's target head is semantically active.
  const selectedHead = p?.targetHeads?.[selectedOperation];
  let target: string | undefined;
  let targetProbabilities: Record<string, number> | undefined;
  if (p?.target !== undefined) {
    target = p.target;
    targetProbabilities = p.targetProbabilities;
  } else if (selectedHead && targetIds.includes(selectedHead.target)) {
    target = selectedHead.target;
    // RFC-012 §20: never convert target *confidence* into a probability. Prefer
    // the head distribution; fall back to the head probability, then nothing.
    targetProbabilities =
      selectedHead.probabilities ??
      p?.targetProbabilities ??
      (selectedHead.probability !== undefined ? { [selectedHead.target]: selectedHead.probability } : undefined);
  }

  const operationConfidence = toDecisionConfidence(predictionConfidence(p));
  const targetConfidence =
    selectedHead && typeof selectedHead.confidence === 'number' && Number.isFinite(selectedHead.confidence)
      ? toDecisionConfidence({ value: selectedHead.confidence, calibrated: selectedHead.calibrated })
      : undefined;

  const answer: ActionAnswer = {
    type: 'action',
    operation: selectedOperation,
    ...(target !== undefined ? { target } : {}),
    ...(p?.operationProbabilities ? { operationProbabilities: p.operationProbabilities } : {}),
    ...(typeof p?.complete === 'boolean' ? { operationProbabilitiesComplete: p.complete } : {}),
    ...(targetProbabilities ? { targetProbabilities } : {}),
    ...(typeof selectedHead?.complete === 'boolean' ? { targetProbabilitiesComplete: selectedHead.complete } : {}),
    ...(operationConfidence ? { operationConfidence, confidence: operationConfidence } : {}),
    ...(targetConfidence ? { targetConfidence } : {}),
  };
  return { kind: 'action', answer };
}

/**
 * Wrap a {@link TypedDecisionBackend} as a provider-neutral
 * {@link DecisionProvider}.
 */
export function createTypedDecisionProvider(
  options: TypedDecisionProviderOptions,
): DecisionProvider {
  const capabilities = options.capabilities ?? ALL_DECISION_CAPABILITIES;
  const provider: DecisionProvider = {
    id: options.id,
    displayName: options.displayName ?? options.id,
    version: options.version ?? options.backend.version ?? '0.0.0',
    capabilities,
    isReady: options.isReady ?? true,
    ...(options.info ? { info: options.info } : {}),

    async decide(request: DecisionProviderRequest): Promise<DecisionProviderOutcome> {
      try {
        const { questions } = buildBackendQuestions(request);
        const backendResult = await options.backend.predict({
          state: request.state,
          questions,
          signal: request.signal,
        });
        const decision = translateBackendResult(request, backendResult.predictions);
        const confidence = aggregateConfidence(decision);
        return {
          ok: true,
          requestId: request.requestId,
          decision,
          ...(confidence !== undefined
            ? { confidence: { value: confidence, source: 'provider' as const } }
            : {}),
          ...(backendResult.usage ? { usage: backendResult.usage } : {}),
          ...(backendResult.upstreamRequestId ? { upstreamRequestId: backendResult.upstreamRequestId } : {}),
          ...(backendResult.raw !== undefined ? { rawProviderOutput: backendResult.raw } : {}),
          provenance: {
            providerId: options.id,
            providerVersion: provider.version,
            source: 'provider-reported',
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          ok: false,
          requestId: request.requestId,
          code: 'PROVIDER_ERROR',
          message,
          retryable: true,
        };
      }
    },

    async cancel(): Promise<DecisionProviderOutcome<void>> {
      return { ok: false, requestId: '', code: 'NOT_IMPLEMENTED', message: 'Backend does not support cancel.', retryable: false };
    },
  };
  return provider;
}

// ── Client-backed adapter seam (Laya / Jev) ────────────────────────────────
//
// Adapters model only their client's vocabulary (e.g. Laya `noul`). The action
// decomposition and reassembly below is shared translation (RFC-012 §24): the
// operation head plus one target head per target-bearing operation. Only the
// selected operation's head is ever read back.

export interface DecisionClientQuestion {
  readonly id: string;
  readonly type: string;
  readonly instruction?: string;
  /** Action goal, when the question is an action head (RFC-012 §24). */
  readonly goal?: string;
  /** The operation this head selects for / belongs to, when applicable. */
  readonly operation?: TypedBackendOperation;
  readonly candidates?: readonly TypedBackendCandidate[];
  readonly rubric?: readonly TypedBackendCandidate[];
  readonly proposition?: string;
}

export interface DecisionClientPrediction {
  readonly selected?: string;
  readonly probabilities?: Record<string, number>;
  readonly distribution?: Record<string, number>;
  readonly expectedScore?: number;
  readonly probability?: number;
  readonly confidence?: number;
  readonly calibrated?: boolean;
  /** When true, `probabilities`/`distribution` covers the candidate set and sums ≈ 1. */
  readonly complete?: boolean;
  readonly [key: string]: unknown;
}

export interface DecisionClientResult {
  readonly predictions: Record<string, DecisionClientPrediction>;
  readonly upstreamRequestId?: string;
  readonly usage?: DecisionUsage;
  readonly raw?: unknown;
}

export interface DecisionClientLike {
  predict(params: {
    readonly model?: string;
    readonly state: DecisionValue;
    readonly questions: readonly DecisionClientQuestion[];
    readonly signal?: AbortSignal;
  }): Promise<DecisionClientResult>;
}

export interface ClientDecisionProviderOptions {
  readonly client: DecisionClientLike;
  readonly id: string;
  readonly displayName?: string;
  readonly version?: string;
  readonly model?: string;
  /** Provider client's probability question type (e.g. `'noul'`). Default `'probability'`. */
  readonly probabilityType?: string;
  /** Provider client's probability value field (e.g. `'noul'`). Default `'probability'`. */
  readonly probabilityField?: string;
  /**
   * Set when the client always returns a full distribution over every choice
   * label (Laya/Jev choice heads). The runtime then enforces coverage + sum ≈ 1.
   */
  readonly choiceComplete?: boolean;
  /**
   * Client-contract sum tolerance for complete distributions. Laya rounds to
   * 4 dp and Jev accepts < 0.02, so typed clients declare ~0.02; deterministic
   * providers keep the 1e-6 default.
   */
  readonly distributionTolerance?: number;
  /** Client-contract selection rule. Laya/Jev select the argmax. */
  readonly choiceSelection?: 'argmax' | 'provider';
  readonly capabilities?: readonly DecisionCapability[];
  readonly isReady?: boolean;
  readonly info?: DecisionProviderInfo;
}

const OPERATION_HEAD = '__operation';
const TARGET_HEAD_PREFIX = '__target:';

function clientQuestionsFromTyped(
  questions: Record<string, TypedBackendQuestion>,
  probabilityType: string,
): DecisionClientQuestion[] {
  const out: DecisionClientQuestion[] = [];
  for (const [id, q] of Object.entries(questions)) {
    if (id === '__action' && q.action) {
      // RFC-012 §24: the operation head carries the goal (as its instruction)
      // plus full operation descriptions/metadata; target heads carry full
      // target objects. Adapters format this into their native shape.
      out.push({
        id: OPERATION_HEAD,
        type: 'choice',
        ...(q.action.goal !== undefined ? { instruction: q.action.goal } : {}),
        candidates: q.action.operations.map((o) => ({ id: o.id, description: o.description, metadata: o.metadata })),
      });
      for (const op of q.action.operations) {
        if (op.targets && op.targets.length > 0) {
          // RFC-012 §24: a target head needs the goal and the selected-operation
          // context to decide *why* it is choosing a target, not just from IDs.
          out.push({
            id: `${TARGET_HEAD_PREFIX}${op.id}`,
            type: 'choice',
            ...(q.action.goal !== undefined ? { goal: q.action.goal } : {}),
            operation: op,
            instruction: `Select the most appropriate ${op.id} target.${q.action.goal ? ` Goal: ${q.action.goal}` : ''}`,
            candidates: op.targets,
          });
        }
      }
      continue;
    }
    if (q.type === 'probability') {
      out.push({ id, type: probabilityType, proposition: q.proposition });
    } else if (q.type === 'score') {
      out.push({ id, type: 'score', ...(q.instruction !== undefined ? { instruction: q.instruction } : {}), rubric: q.rubric });
    } else {
      out.push({ id, type: 'choice', ...(q.instruction !== undefined ? { instruction: q.instruction } : {}), candidates: q.candidates });
    }
  }
  return out;
}

function readProbability(
  p: DecisionClientPrediction | undefined,
  field: string,
): number | undefined {
  if (!p) return undefined;
  if (typeof p.probability === 'number') return p.probability;
  const raw = p[field];
  if (typeof raw === 'number') return raw;
  return undefined;
}

/**
 * Resolve distribution completeness. Explicit client metadata wins; otherwise a
 * client whose contract guarantees full choice distributions (Laya/Jev) is
 * marked complete whenever it returns probabilities.
 */
function resolveComplete(
  p: DecisionClientPrediction | undefined,
  choiceComplete: boolean,
): boolean | undefined {
  if (typeof p?.complete === 'boolean') return p.complete;
  if (choiceComplete && p?.probabilities) return true;
  return undefined;
}

function clientPredictionsToTyped(
  questions: Record<string, TypedBackendQuestion>,
  client: Record<string, DecisionClientPrediction>,
  probabilityField: string,
  choiceComplete: boolean,
): Record<string, TypedBackendPrediction> {
  const out: Record<string, TypedBackendPrediction> = {};
  for (const [id, q] of Object.entries(questions)) {
    const p = client[id];
    if (id === '__action' && q.action) {
      const opPred = client[OPERATION_HEAD];
      const targetHeads: NonNullable<TypedBackendPrediction['targetHeads']> = {};
      for (const op of q.action.operations) {
        if (!op.targets || op.targets.length === 0) continue;
        const head = client[`${TARGET_HEAD_PREFIX}${op.id}`];
        if (head?.selected !== undefined) {
          // RFC-012 hardening #4: retain the selected operation's target head
          // evidence (distribution + confidence + completeness) so
          // minTargetConfidence and entropy checks work.
          const complete = resolveComplete(head, choiceComplete);
          targetHeads[op.id] = {
            target: head.selected,
            ...(selectedProbability(head.probabilities, head.selected) !== undefined
              ? { probability: selectedProbability(head.probabilities, head.selected) }
              : {}),
            ...(head.probabilities ? { probabilities: head.probabilities } : {}),
            ...(typeof head.confidence === 'number' ? { confidence: head.confidence } : {}),
            ...(typeof head.calibrated === 'boolean' ? { calibrated: head.calibrated } : {}),
            ...(complete !== undefined ? { complete } : {}),
          };
        }
      }
      const opComplete = resolveComplete(opPred, choiceComplete);
      out.__action = {
        type: 'action',
        ...(opPred?.selected !== undefined ? { operation: opPred.selected } : {}),
        ...(opPred?.probabilities ? { operationProbabilities: opPred.probabilities } : {}),
        ...(Object.keys(targetHeads).length > 0 ? { targetHeads } : {}),
        ...(typeof opPred?.confidence === 'number' ? { confidence: opPred.confidence } : {}),
        ...(typeof opPred?.calibrated === 'boolean' ? { calibrated: opPred.calibrated } : {}),
        ...(opComplete !== undefined ? { complete: opComplete } : {}),
      };
      continue;
    }
    if (q.type === 'probability') {
      const value = readProbability(p, probabilityField);
      out[id] = {
        type: 'probability',
        ...(value !== undefined ? { probabilityTrue: value } : {}),
        ...(typeof p?.confidence === 'number' ? { confidence: p.confidence } : {}),
        ...(typeof p?.calibrated === 'boolean' ? { calibrated: p.calibrated } : {}),
      };
      continue;
    }
    if (q.type === 'score') {
      out[id] = {
        type: 'score',
        ...(p?.selected !== undefined ? { selected: p.selected } : {}),
        ...(p?.distribution ? { distribution: p.distribution } : {}),
        ...(typeof p?.complete === 'boolean' ? { complete: p.complete } : {}),
        ...(p?.expectedScore !== undefined ? { expectedScore: p.expectedScore } : {}),
        ...(typeof p?.confidence === 'number' ? { confidence: p.confidence } : {}),
        ...(typeof p?.calibrated === 'boolean' ? { calibrated: p.calibrated } : {}),
      };
      continue;
    }
    const choiceCompleteness = resolveComplete(p, choiceComplete);
    out[id] = {
      type: 'choice',
      ...(p?.selected !== undefined ? { selected: p.selected } : {}),
      ...(p?.probabilities ? { probabilities: p.probabilities } : {}),
      ...(choiceCompleteness !== undefined ? { complete: choiceCompleteness } : {}),
      ...(typeof p?.confidence === 'number' ? { confidence: p.confidence } : {}),
      ...(typeof p?.calibrated === 'boolean' ? { calibrated: p.calibrated } : {}),
    };
  }
  return out;
}

function selectedProbability(
  probabilities: Record<string, number> | undefined,
  selected: string | undefined,
): number | undefined {
  if (!probabilities || selected === undefined) return undefined;
  return probabilities[selected];
}

/**
 * Wrap a provider-specific client as a {@link DecisionProvider}, translating
 * only vocabulary. Output stays untrusted and is re-validated by the runtime.
 */
export function createClientDecisionProvider(
  options: ClientDecisionProviderOptions,
): DecisionProvider {
  const probabilityType = options.probabilityType ?? 'probability';
  const probabilityField = options.probabilityField ?? 'probability';
  const choiceComplete = options.choiceComplete === true;
  const backend: TypedDecisionBackend = {
    id: options.id,
    version: options.version,
    async predict({ state, questions, signal }) {
      const clientQuestions = clientQuestionsFromTyped(questions, probabilityType);
      const result = await options.client.predict({
        ...(options.model ? { model: options.model } : {}),
        state,
        questions: clientQuestions,
        ...(signal ? { signal } : {}),
      });
      return {
        predictions: clientPredictionsToTyped(questions, result.predictions, probabilityField, choiceComplete),
        ...(result.usage ? { usage: result.usage } : {}),
        ...(result.upstreamRequestId ? { upstreamRequestId: result.upstreamRequestId } : {}),
        ...(result.raw !== undefined ? { raw: result.raw } : {}),
      };
    },
  };

  const info: DecisionProviderInfo = {
    ...(options.info ?? {}),
    ...(options.distributionTolerance !== undefined ? { distributionTolerance: options.distributionTolerance } : {}),
    ...(options.choiceSelection !== undefined ? { choiceSelection: options.choiceSelection } : {}),
  };

  return createTypedDecisionProvider({
    backend,
    id: options.id,
    displayName: options.displayName,
    version: options.version,
    capabilities: options.capabilities,
    isReady: options.isReady,
    ...(Object.keys(info).length > 0 ? { info } : {}),
  });
}
