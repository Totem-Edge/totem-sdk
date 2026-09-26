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
  DecisionProvider,
  DecisionProviderInfo,
  DecisionProviderOutcome,
  DecisionProviderRequest,
  DecisionResult,
  DecisionUsage,
  DecisionValue,
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
        questions[q.id] = { id: q.id, type: 'score', rubric: q.rubric.map((c) => c.id) };
      } else {
        questions[q.id] = { id: q.id, type: 'choice', candidates: q.criteria.map((c) => c.id) };
      }
    }
    return { questions };
  }
  questions.__action = {
    id: '__action',
    type: 'action',
    operations: request.operations.map((op) => ({
      id: op.id,
      targets: (op.targets ?? []).map((t) => t.id),
    })),
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
  if (p?.target !== undefined) {
    target = p.target;
  } else if (selectedHead && targetIds.includes(selectedHead.target)) {
    target = selectedHead.target;
  }

  const conf = predictionConfidence(p);
  const answer: ActionAnswer = {
    type: 'action',
    operation: selectedOperation,
    ...(target !== undefined ? { target } : {}),
    ...(p?.operationProbabilities ? { operationProbabilities: p.operationProbabilities } : {}),
    ...(p?.targetProbabilities ? { targetProbabilities: p.targetProbabilities } : {}),
    ...(conf ? { confidence: { value: conf.value, source: 'provider', ...(conf.calibrated !== undefined ? { calibrated: conf.calibrated } : {}) } } : {}),
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
  readonly candidates?: readonly string[];
  readonly rubric?: readonly string[];
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
    if (id === '__action' && q.operations) {
      out.push({ id: OPERATION_HEAD, type: 'choice', candidates: q.operations.map((o) => o.id) });
      for (const op of q.operations) {
        if (op.targets && op.targets.length > 0) {
          out.push({ id: `${TARGET_HEAD_PREFIX}${op.id}`, type: 'choice', candidates: op.targets });
        }
      }
      continue;
    }
    if (q.type === 'probability') {
      out.push({ id, type: probabilityType, proposition: q.proposition });
    } else if (q.type === 'score') {
      out.push({ id, type: 'score', rubric: q.rubric });
    } else {
      out.push({ id, type: 'choice', candidates: q.candidates });
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

function clientPredictionsToTyped(
  questions: Record<string, TypedBackendQuestion>,
  client: Record<string, DecisionClientPrediction>,
  probabilityField: string,
): Record<string, TypedBackendPrediction> {
  const out: Record<string, TypedBackendPrediction> = {};
  for (const [id, q] of Object.entries(questions)) {
    const p = client[id];
    if (id === '__action' && q.operations) {
      const opPred = client[OPERATION_HEAD];
      const targetHeads: Record<string, { target: string; probability?: number }> = {};
      for (const op of q.operations) {
        if (!op.targets || op.targets.length === 0) continue;
        const head = client[`${TARGET_HEAD_PREFIX}${op.id}`];
        if (head?.selected !== undefined) {
          targetHeads[op.id] = {
            target: head.selected,
            ...(selectedProbability(head.probabilities, head.selected) !== undefined
              ? { probability: selectedProbability(head.probabilities, head.selected) }
              : {}),
          };
        }
      }
      out.__action = {
        type: 'action',
        ...(opPred?.selected !== undefined ? { operation: opPred.selected } : {}),
        ...(opPred?.probabilities ? { operationProbabilities: opPred.probabilities } : {}),
        ...(Object.keys(targetHeads).length > 0 ? { targetHeads } : {}),
        ...(typeof opPred?.confidence === 'number' ? { confidence: opPred.confidence } : {}),
        ...(typeof opPred?.calibrated === 'boolean' ? { calibrated: opPred.calibrated } : {}),
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
        ...(p?.expectedScore !== undefined ? { expectedScore: p.expectedScore } : {}),
        ...(typeof p?.confidence === 'number' ? { confidence: p.confidence } : {}),
        ...(typeof p?.calibrated === 'boolean' ? { calibrated: p.calibrated } : {}),
      };
      continue;
    }
    out[id] = {
      type: 'choice',
      ...(p?.selected !== undefined ? { selected: p.selected } : {}),
      ...(p?.probabilities ? { probabilities: p.probabilities } : {}),
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
        predictions: clientPredictionsToTyped(questions, result.predictions, probabilityField),
        ...(result.usage ? { usage: result.usage } : {}),
        ...(result.upstreamRequestId ? { upstreamRequestId: result.upstreamRequestId } : {}),
        ...(result.raw !== undefined ? { raw: result.raw } : {}),
      };
    },
  };

  return createTypedDecisionProvider({
    backend,
    id: options.id,
    displayName: options.displayName,
    version: options.version,
    capabilities: options.capabilities,
    isReady: options.isReady,
    info: options.info,
  });
}
