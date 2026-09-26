/**
 * @module @totemsdk/decision/canonical
 *
 * Canonical values, domain-separated digests, and freshness binding.
 *
 * Determinism (RFC-012 §28): object keys are sorted by `canonicalJson`, but
 * **arrays preserve caller order**. Candidate/rubric ordering is semantic and
 * therefore changes the candidate-set digest.
 */

import { canonicalJson, hashCanonical } from '@totemsdk/core';
import { DECISION_DIGEST_DOMAINS } from './constants.js';
import { DecisionError } from './errors.js';
import type {
  DecisionProviderRequest,
  DecisionRequest,
  DecisionRequestBindings,
  DecisionResult,
  DecisionValue,
} from './types.js';

// ── Value validation ───────────────────────────────────────────────────────

/**
 * Assert that `value` is a canonical {@link DecisionValue}. Rejects `NaN`,
 * `±Infinity`, `undefined`, functions, symbols, dates, class instances, and
 * cyclic structures.
 */
export function assertDecisionValue(
  value: unknown,
  path = '$',
): asserts value is DecisionValue {
  const seen = new Set<object>();

  const walk = (v: unknown, p: string): void => {
    if (v === null) return;
    const t = typeof v;
    if (t === 'string' || t === 'boolean') return;
    if (t === 'number') {
      if (!Number.isFinite(v as number)) {
        throw new DecisionError('NON_FINITE_NUMBER', `Non-finite number at ${p}.`);
      }
      return;
    }
    if (t === 'undefined') {
      throw new DecisionError('INVALID_REQUEST', `undefined is not a valid decision value at ${p}.`);
    }
    if (t === 'function' || t === 'symbol' || t === 'bigint') {
      throw new DecisionError('INVALID_REQUEST', `Unsupported ${t} at ${p}.`);
    }
    if (Array.isArray(v)) {
      if (seen.has(v)) {
        throw new DecisionError('INVALID_REQUEST', `Cyclic array at ${p}.`);
      }
      seen.add(v);
      v.forEach((item, i) => walk(item, `${p}[${i}]`));
      seen.delete(v);
      return;
    }
    // Plain objects only.
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) {
      throw new DecisionError('INVALID_REQUEST', `Non-plain object at ${p}.`);
    }
    if (seen.has(v as object)) {
      throw new DecisionError('INVALID_REQUEST', `Cyclic object at ${p}.`);
    }
    seen.add(v as object);
    for (const [k, item] of Object.entries(v as Record<string, unknown>)) {
      walk(item, `${p}.${k}`);
    }
    seen.delete(v as object);
  };

  walk(value, path);
}

/** Non-throwing variant of {@link assertDecisionValue}. */
export function isDecisionValue(value: unknown): value is DecisionValue {
  try {
    assertDecisionValue(value);
    return true;
  } catch {
    return false;
  }
}

// ── Projections ────────────────────────────────────────────────────────────

/**
 * Candidate-set projection: IDs/types, criterion IDs in caller order, ordered
 * rubric, operation/target IDs, and semantic descriptions/metadata.
 */
function candidateProjection(request: DecisionRequest): unknown {
  if (request.kind === 'action') {
    return {
      kind: 'action',
      operations: request.operations.map((op) => ({
        id: op.id,
        description: op.description ?? null,
        metadata: op.metadata ?? null,
        targets: (op.targets ?? []).map((t) => ({
          id: t.id,
          description: t.description ?? null,
          metadata: t.metadata ?? null,
        })),
      })),
    };
  }
  return {
    kind: 'questions',
    questions: request.questions.map((q) => {
      if (q.type === 'probability') {
        return { id: q.id, type: q.type };
      }
      if (q.type === 'score') {
        return {
          id: q.id,
          type: q.type,
          rubric: q.rubric.map((c) => ({
            id: c.id,
            description: c.description ?? null,
            metadata: c.metadata ?? null,
          })),
        };
      }
      return {
        id: q.id,
        type: q.type,
        criteria: q.criteria.map((c) => ({
          id: c.id,
          description: c.description ?? null,
          metadata: c.metadata ?? null,
        })),
      };
    }),
  };
}

/**
 * Request-semantics projection: identity/transport fields (`requestId`,
 * `context`, `signal`) are excluded (RFC-012 §29).
 */
function requestProjection(
  request: DecisionRequest,
  bindings: { stateDigest: string; candidateSetDigest: string },
): unknown {
  if (request.kind === 'action') {
    return {
      kind: 'action',
      stateDigest: bindings.stateDigest,
      candidateSetDigest: bindings.candidateSetDigest,
      goal: request.goal ?? null,
    };
  }
  return {
    kind: 'questions',
    stateDigest: bindings.stateDigest,
    candidateSetDigest: bindings.candidateSetDigest,
    questions: request.questions.map((q) => ({
      id: q.id,
      type: q.type,
      instruction: q.type === 'probability' ? null : (q.instruction ?? null),
      proposition: q.type === 'probability' ? q.proposition : null,
    })),
  };
}

// ── Digests ────────────────────────────────────────────────────────────────

export function computeStateDigest(state: DecisionValue): string {
  assertDecisionValue(state, '$.state');
  return hashCanonical(DECISION_DIGEST_DOMAINS.state, state);
}

export function computeCandidateSetDigest(request: DecisionRequest): string {
  return hashCanonical(DECISION_DIGEST_DOMAINS.candidates, candidateProjection(request));
}

/**
 * Compute the request-scoped bindings. `requestId`, `context`, `signal`, and
 * other transport metadata are excluded.
 */
export function computeDecisionBindings(
  request: DecisionRequest,
): DecisionRequestBindings {
  assertDecisionValue(request.state, '$.state');
  const stateDigest = computeStateDigest(request.state);
  const candidateSetDigest = computeCandidateSetDigest(request);
  const requestDigest = hashCanonical(
    DECISION_DIGEST_DOMAINS.request,
    requestProjection(request, { stateDigest, candidateSetDigest }),
  );
  return { stateDigest, candidateSetDigest, requestDigest };
}

export function computeOutputDigest(decision: DecisionResult): string {
  return hashCanonical(DECISION_DIGEST_DOMAINS.output, decision);
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Canonical state size in bytes (UTF-8 of the canonical JSON). */
export function stateByteLength(state: DecisionValue): number {
  return new TextEncoder().encode(canonicalJson(state)).length;
}

/** Canonical JSON of a value (exported for tests/diagnostics). */
export function canonicalDecisionJson(value: unknown): string {
  return canonicalJson(value);
}

// ── Freshness ──────────────────────────────────────────────────────────────

/**
 * A result is fresh when its `requestDigest` equals the digest of the current
 * request. Because `requestDigest` incorporates state and candidate digests, it
 * also invalidates on state, candidate-set, goal, or instruction changes
 * (RFC-012 §30).
 */
export function isDecisionFresh(
  result: { bindings?: { requestDigest: string } },
  currentRequest: DecisionRequest,
): boolean {
  if (!result.bindings) return false;
  return result.bindings.requestDigest === computeDecisionBindings(currentRequest).requestDigest;
}

/** @throws {DecisionError} `STALE_DECISION` when not fresh. */
export function assertDecisionFresh(
  result: { bindings?: { requestDigest: string } },
  currentRequest: DecisionRequest,
): void {
  if (!isDecisionFresh(result, currentRequest)) {
    throw new DecisionError('STALE_DECISION');
  }
}
