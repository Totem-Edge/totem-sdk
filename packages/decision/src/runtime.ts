/**
 * @module @totemsdk/decision/runtime
 *
 * `createDecisionRuntime` — deterministic routing, candidate-constrained
 * validation, acceptance, and escalation.
 *
 * Trust boundary (RFC-012 §4.3): providers propose; the runtime certifies.
 * Providers can never supply bindings, receipts, or attempt history.
 */

import type {
  DecisionAttempt,
  DecisionAcceptanceRule,
  DecisionProvider,
  DecisionProviderOutcome,
  DecisionProviderRequest,
  DecisionRequest,
  DecisionResult,
  DecisionRoute,
  DecisionRuntime,
  DecisionRuntimeOptions,
  DecisionSuccess,
  DecisionFailure,
  DecisionOutcome,
  DecisionRequestBindings,
  DecisionProvenance,
} from './types.js';
import { DecisionError, type DecisionEscalationReason } from './errors.js';
import { DECISION_TYPES, type DecisionCapability } from './constants.js';
import { aggregateConfidence, evaluateAcceptance } from './acceptance.js';
import {
  computeDecisionBindings,
  computeOutputDigest,
  stateByteLength,
} from './canonical.js';
import {
  deriveRequestedTypes,
  deriveRequiredCapabilities,
  validateDecisionRequest,
  validateProviderDecision,
  type DecisionLimits,
} from './validation.js';
import { createDecisionReceipt } from './receipts.js';

let requestCounter = 0;

function nextRequestId(): string {
  requestCounter += 1;
  const rand =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${requestCounter.toString(36)}`;
  return `decision-${rand}`;
}

function resolveProvider(
  route: DecisionRoute,
  providers?: Record<string, DecisionProvider>,
): DecisionProvider | undefined {
  if (typeof route.provider === 'string') return providers?.[route.provider];
  return route.provider;
}

function toProviderRequest(
  request: DecisionRequest,
  requestId: string,
  signal: AbortSignal | undefined,
): DecisionProviderRequest {
  if (request.kind === 'action') {
    return {
      kind: 'action',
      requestId,
      state: request.state,
      ...(request.goal !== undefined ? { goal: request.goal } : {}),
      operations: request.operations,
      ...(signal ? { signal } : {}),
    };
  }
  return {
    kind: 'questions',
    requestId,
    state: request.state,
    questions: request.questions,
    ...(signal ? { signal } : {}),
  };
}

interface Eligibility {
  readonly eligible: boolean;
  readonly reason?: DecisionEscalationReason;
  readonly message?: string;
}

function checkEligibility(
  route: DecisionRoute,
  provider: DecisionProvider,
  request: DecisionRequest,
  requiredCaps: readonly string[],
): Eligibility {
  if (!provider.isReady) {
    return { eligible: false, reason: 'UNAVAILABLE', message: 'Provider is not ready.' };
  }

  const requestedTypes = deriveRequestedTypes(request);
  if (route.types && !requestedTypes.every((t) => route.types!.includes(t))) {
    return { eligible: false, reason: 'INELIGIBLE', message: 'Route does not declare all requested decision types.' };
  }
  for (const cap of requiredCaps) {
    if (!provider.capabilities.includes(cap as never)) {
      return { eligible: false, reason: 'INELIGIBLE', message: `Provider lacks capability ${cap}.` };
    }
  }

  const info = provider.info ?? {};
  const limits: Required<DecisionLimits> = {
    maxQuestions: route.maxQuestions ?? info.maxQuestions ?? Infinity,
    maxCandidatesPerQuestion: route.maxCandidatesPerQuestion ?? info.maxCandidatesPerQuestion ?? Infinity,
    maxOperations: route.maxOperations ?? info.maxOperations ?? Infinity,
    maxTargetsPerOperation: route.maxTargetsPerOperation ?? info.maxTargetsPerOperation ?? Infinity,
    maxStateBytes: route.maxStateBytes ?? info.maxStateBytes ?? Infinity,
  };

  if (stateByteLength(request.state) > limits.maxStateBytes) {
    return { eligible: false, reason: 'LIMIT_EXCEEDED', message: 'State exceeds provider limit.' };
  }
  if (request.kind === 'questions') {
    if (request.questions.length > limits.maxQuestions) {
      return { eligible: false, reason: 'LIMIT_EXCEEDED', message: 'Too many questions.' };
    }
    for (const q of request.questions) {
      if (q.type === 'probability') continue;
      const n = (q.type === 'score' ? q.rubric : q.criteria).length;
      if (n > limits.maxCandidatesPerQuestion) {
        return { eligible: false, reason: 'LIMIT_EXCEEDED', message: `Question "${q.id}" exceeds candidate limit.` };
      }
    }
  } else {
    if (request.operations.length > limits.maxOperations) {
      return { eligible: false, reason: 'LIMIT_EXCEEDED', message: 'Too many operations.' };
    }
    for (const op of request.operations) {
      if ((op.targets ?? []).length > limits.maxTargetsPerOperation) {
        return { eligible: false, reason: 'LIMIT_EXCEEDED', message: `Operation "${op.id}" exceeds target limit.` };
      }
    }
  }

  return { eligible: true };
}

export function createDecisionRuntime(
  options: DecisionRuntimeOptions,
): DecisionRuntime {
  const now = options.now ?? (() => Date.now());
  const generateRequestId = options.generateRequestId !== false;
  const includeRaw = options.includeRawProviderOutput === true;

  /** requestId -> in-flight decision (for hard cancellation). */
  const inFlight = new Map<string, InFlightDecision>();

  async function decide(request: DecisionRequest): Promise<DecisionOutcome> {
    // RFC-012 hardening #12: a request id must be a real identifier. An empty
    // string is never a cancellation/receipt handle, and when generation is
    // disabled the caller must supply one.
    const providedId = request.requestId;
    if (providedId !== undefined && (typeof providedId !== 'string' || providedId.trim().length === 0)) {
      return { ok: false, requestId: '', code: 'INVALID_REQUEST', message: 'requestId must be a non-empty string.', attempts: [] };
    }
    if (providedId === undefined && !generateRequestId) {
      return { ok: false, requestId: '', code: 'INVALID_REQUEST', message: 'requestId is required when request-id generation is disabled.', attempts: [] };
    }
    const requestId = providedId ?? nextRequestId();

    let requestBindings: DecisionRequestBindings;
    try {
      validateDecisionRequest(request);
      requestBindings = computeDecisionBindings(request);
    } catch (err) {
      const e = err instanceof DecisionError ? err : new DecisionError('INTERNAL', String(err));
      return { ok: false, requestId, code: e.code, message: e.message, attempts: [] };
    }

    const attempts: DecisionAttempt[] = [];
    const requiredCaps = deriveRequiredCapabilities(request);

    // RFC-012 hardening #8: reject concurrent duplicate request ids. Cancellation
    // accepts only a requestId, so duplicates would make it ambiguous.
    if (inFlight.has(requestId)) {
      return {
        ok: false,
        requestId,
        code: 'DUPLICATE_REQUEST_ID',
        message: new DecisionError('DUPLICATE_REQUEST_ID').message,
        attempts: [],
        bindings: requestBindings,
      };
    }

    for (const route of options.routes) {
      const provider = resolveProvider(route, options.providers);
      if (!provider) {
        const attempt = skippedAttempt('unknown', 'INELIGIBLE', route, now());
        attempts.push(attempt);
        options.onAttempt?.(attempt);
        continue;
      }

      const eligibility = checkEligibility(route, provider, request, requiredCaps);
      if (!eligibility.eligible) {
        const attempt = skippedAttempt(provider.id, eligibility.reason ?? 'INELIGIBLE', route, now(), provider.version, eligibility.message);
        attempts.push(attempt);
        options.onAttempt?.(attempt);
        continue;
      }

      const startedAt = now();
      if (request.signal?.aborted) {
        return { ok: false, requestId, code: 'CANCELLED', message: new DecisionError('CANCELLED').message, attempts, bindings: requestBindings };
      }

      const controller = new AbortController();
      const timeoutMs = route.timeoutMs ?? options.defaultTimeoutMs;
      let stopReason: 'CANCELLED' | 'TIMEOUT' | null = null;
      let resolveStop!: () => void;
      const stopSignal = new Promise<null>((resolve) => {
        resolveStop = () => resolve(null);
      });

      // RFC-012 hardening #12: the runtime owns the stop path. Caller abort,
      // explicit cancel, and timeout all abort the same controller, best-effort
      // cancel the provider, and win the race — so a provider that ignores its
      // AbortSignal can never keep the runtime waiting.
      const stop = (reason: 'CANCELLED' | 'TIMEOUT'): void => {
        if (stopReason !== null) return;
        stopReason = reason;
        controller.abort();
        void provider.cancel?.(requestId).catch(() => undefined);
        resolveStop();
      };

      const onOuterAbort = (): void => stop('CANCELLED');
      if (request.signal) request.signal.addEventListener('abort', onOuterAbort, { once: true });

      // RFC-012 hardening #7: shortlisting is deferred for v0.1 (interface kept
      // as a future seam). The runtime sends the exact candidate space and the
      // receipt's candidateSetDigest matches what the provider saw.
      const providerRequest = toProviderRequest(request, requestId, controller.signal);

      inFlight.set(requestId, { provider, controller, cancel: () => stop('CANCELLED') });
      let providerOutcome: DecisionProviderOutcome;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const call = provider.decide(providerRequest).catch((err): DecisionProviderOutcome => ({
          ok: false,
          requestId,
          code: 'PROVIDER_ERROR',
          message: err instanceof Error ? err.message : String(err),
          retryable: true,
        }));

        if (timeoutMs !== undefined && timeoutMs > 0) {
          timer = setTimeout(() => stop('TIMEOUT'), timeoutMs);
        }

        const raced = await Promise.race([call, stopSignal]);
        // `stopReason` is always set before `stopSignal` resolves, so a stop
        // takes precedence over a provider that resolved while being stopped.
        if (stopReason === 'TIMEOUT') {
          void call.catch(() => undefined);
          providerOutcome = { ok: false, requestId, code: 'TIMEOUT', message: 'Provider timed out.', retryable: true };
        } else if (stopReason === 'CANCELLED') {
          void call.catch(() => undefined);
          providerOutcome = { ok: false, requestId, code: 'CANCELLED', message: 'Cancelled.', retryable: false };
        } else {
          providerOutcome = raced as DecisionProviderOutcome;
        }
      } finally {
        if (timer) clearTimeout(timer);
        inFlight.delete(requestId);
        if (request.signal) request.signal.removeEventListener('abort', onOuterAbort);
      }

      const durationMs = now() - startedAt;

      // Caller/explicit cancellation is terminal and never escalates (RFC-012 §27).
      if (stopReason === 'CANCELLED') {
        const attempt: DecisionAttempt = {
          providerId: provider.id,
          providerVersion: provider.version,
          startedAt,
          durationMs,
          accepted: false,
          reason: 'CANCELLED',
          errorCode: 'CANCELLED',
          message: 'Cancelled.',
        };
        attempts.push(attempt);
        options.onAttempt?.(attempt);
        return { ok: false, requestId, code: 'CANCELLED', message: 'Cancelled.', attempts, bindings: requestBindings };
      }

      if (!providerOutcome.ok) {
        const attempt: DecisionAttempt = {
          providerId: provider.id,
          providerVersion: provider.version,
          startedAt,
          durationMs,
          accepted: false,
          reason: providerOutcome.code === 'TIMEOUT' ? 'TIMEOUT' : providerOutcome.code === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'PROVIDER_ERROR',
          errorCode: providerOutcome.code,
          message: providerOutcome.message,
        };
        attempts.push(attempt);
        options.onAttempt?.(attempt);
        if (stopReason === 'TIMEOUT' && route.escalateOnTimeout === false) {
          return { ok: false, requestId, code: 'TIMEOUT', message: providerOutcome.message, attempts, bindings: requestBindings };
        }
        continue;
      }

      // Validate + normalize against the offered candidate space.
      let decision: DecisionResult;
      try {
        decision = validateProviderDecision(providerRequest, providerOutcome.decision, {
          ...(provider.info?.distributionTolerance !== undefined ? { tolerance: provider.info.distributionTolerance } : {}),
          ...(provider.info?.choiceSelection !== undefined ? { choiceSelection: provider.info.choiceSelection } : {}),
        });
      } catch (err) {
        const e = err instanceof DecisionError ? err : new DecisionError('INVALID_OUTPUT', String(err));
        const attempt: DecisionAttempt = {
          providerId: provider.id,
          providerVersion: provider.version,
          startedAt,
          durationMs,
          accepted: false,
          reason: 'INVALID_OUTPUT',
          errorCode: e.code,
          message: e.message,
        };
        attempts.push(attempt);
        options.onAttempt?.(attempt);
        continue;
      }

      // RFC-012 hardening #6: acceptance is computed from the canonical answers
      // (min across answers for batched questions). A provider-level aggregate
      // confidence is reporting metadata and must not override a low-confidence
      // individual answer.
      const confidence = aggregateConfidence(decision);
      const evaluation = evaluateAcceptance(route.accept, {
        request: providerRequest,
        provider,
        decision,
        confidence,
      });

      const attempt: DecisionAttempt = {
        providerId: provider.id,
        providerVersion: provider.version,
        startedAt,
        durationMs,
        accepted: evaluation.accepted,
        ...(evaluation.reason ? { reason: evaluation.reason } : {}),
        ...(evaluation.confidence !== undefined ? { confidence: evaluation.confidence } : {}),
      };
      attempts.push(attempt);
      options.onAttempt?.(attempt);

      if (!evaluation.accepted) {
        continue;
      }

      const outputDigest = computeOutputDigest(decision);
      const bindings = { ...requestBindings, outputDigest };
      const finalConfidence = evaluation.confidence ?? aggregateConfidence(decision);

      // RFC-012 hardening #10: the runtime normalizes one final provenance
      // object, merging the trusted route provider identity, static declared
      // metadata, and call-specific provider metadata (call-specific wins) so
      // the result and the receipt tell the same story.
      const callProvenance = providerOutcome.provenance;
      const declared = provider.info;
      const model = callProvenance?.model ?? declared?.model;
      const runtimeRef = callProvenance?.runtime ?? declared?.runtime;
      const locality = callProvenance?.locality ?? declared?.locality;
      const upstreamRequestId = providerOutcome.upstreamRequestId ?? callProvenance?.upstreamRequestId;
      const finalProvenance: DecisionProvenance = {
        providerId: provider.id,
        providerVersion: provider.version,
        ...(model ? { model } : {}),
        ...(runtimeRef ? { runtime: runtimeRef } : {}),
        ...(locality ? { locality } : {}),
        ...(upstreamRequestId ? { upstreamRequestId } : {}),
        source: callProvenance?.source ?? 'declared',
      };

      const receipt = createDecisionReceipt({
        version: 1,
        requestId,
        provider: { id: provider.id, version: provider.version },
        ...(model ? { model } : {}),
        ...(runtimeRef ? { runtime: runtimeRef } : {}),
        stateDigest: bindings.stateDigest,
        candidateSetDigest: bindings.candidateSetDigest,
        requestDigest: bindings.requestDigest,
        outputDigest,
        decisionKind: decision.kind,
        issuedAt: now(),
        durationMs,
        ...(finalConfidence !== undefined ? { confidence: finalConfidence } : {}),
        ...(upstreamRequestId ? { upstreamRequestId } : {}),
      });
      options.onReceipt?.(receipt);

      const success: DecisionSuccess = {
        ok: true,
        requestId,
        decision,
        provider: { id: provider.id, version: provider.version },
        bindings,
        receipt,
        attempts,
        ...(providerOutcome.usage ? { usage: providerOutcome.usage } : {}),
        ...(finalConfidence !== undefined ? { confidence: finalConfidence } : {}),
        provenance: finalProvenance,
        ...(upstreamRequestId ? { upstreamRequestId } : {}),
        ...(includeRaw && providerOutcome.rawProviderOutput !== undefined
          ? { rawProviderOutput: providerOutcome.rawProviderOutput }
          : {}),
      };
      return success;
    }

    return {
      ok: false,
      requestId,
      code: 'NO_ACCEPTABLE_RESULT',
      message: new DecisionError('NO_ACCEPTABLE_RESULT').message,
      attempts,
      bindings: requestBindings,
    };
  }

  async function cancel(requestId: string): Promise<DecisionProviderOutcome<void>> {
    // RFC-012 hardening #12: hard cancellation. The runtime aborts its own wait
    // and best-effort cancels the provider regardless of whether it cooperates.
    const entry = inFlight.get(requestId);
    if (!entry) {
      return { ok: false, requestId, code: 'NOT_IMPLEMENTED', message: 'No cancellable operation for request id.', retryable: false };
    }
    entry.cancel();
    return { ok: true, requestId };
  }

  async function close(): Promise<void> {
    // RFC-012 hardening #9: close each unique configured provider once.
    const providers = new Set<DecisionProvider>();
    for (const route of options.routes) {
      const p = resolveProvider(route, options.providers);
      if (p) providers.add(p);
    }
    if (options.providers) for (const p of Object.values(options.providers)) providers.add(p);
    for (const p of providers) {
      try {
        await p.close?.();
      } catch {
        // A failing provider close must not block the others.
      }
    }
  }

  // RFC-012 hardening #10: advertise only the capabilities actually reachable
  // through the configured routes (respecting route.types and provider
  // capability declarations).
  function capabilities(): DecisionCapability[] {
    const out = new Set<DecisionCapability>();
    for (const route of options.routes) {
      const p = resolveProvider(route, options.providers);
      if (!p) continue;
      const declared = DECISION_TYPES.filter((t) =>
        p.capabilities.includes(`decision:${t}` as DecisionCapability),
      );
      for (const t of route.types ?? declared) {
        const cap = `decision:${t}` as DecisionCapability;
        if (p.capabilities.includes(cap)) out.add(cap);
      }
    }
    return [...out];
  }

  return { capabilities: capabilities(), decide, cancel, close };
}

function skippedAttempt(
  providerId: string,
  reason: DecisionEscalationReason,
  route: DecisionRoute,
  at: number,
  providerVersion?: string,
  message?: string,
): DecisionAttempt {
  const id = providerId === 'unknown' && typeof route.provider === 'string' ? route.provider : providerId;
  return {
    providerId: id,
    ...(providerVersion ? { providerVersion } : {}),
    startedAt: at,
    durationMs: 0,
    accepted: false,
    skipped: true,
    reason,
    ...(message ? { message } : {}),
  };
}

/** An in-flight decision the runtime owns and can hard-cancel. */
interface InFlightDecision {
  readonly provider: DecisionProvider;
  readonly controller: AbortController;
  /** Abort the runtime's wait and best-effort cancel the provider. */
  readonly cancel: () => void;
}

export type { DecisionAcceptanceRule, DecisionFailure };
