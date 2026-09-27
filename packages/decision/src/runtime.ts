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
} from './types.js';
import { DecisionError, type DecisionEscalationReason } from './errors.js';
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

  /** requestId -> provider currently handling it (for cancellation). */
  const inFlight = new Map<string, DecisionProvider>();

  async function decide(request: DecisionRequest): Promise<DecisionOutcome> {
    const requestId = request.requestId ?? (generateRequestId ? nextRequestId() : '');

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
      let timedOut = false;
      const timeoutMs = route.timeoutMs ?? options.defaultTimeoutMs;

      const onOuterAbort = (): void => {
        controller.abort();
        // Best-effort cancellation of the active provider.
        void provider.cancel?.(requestId).catch(() => undefined);
      };
      if (request.signal) request.signal.addEventListener('abort', onOuterAbort, { once: true });

      // RFC-012 hardening #7: shortlisting is deferred for v0.1 (interface kept
      // as a future seam). The runtime sends the exact candidate space and the
      // receipt's candidateSetDigest matches what the provider saw.
      const providerRequest = toProviderRequest(request, requestId, controller.signal);

      inFlight.set(requestId, provider);
      let providerOutcome: DecisionProviderOutcome;
      try {
        const call = provider.decide(providerRequest).catch((err): DecisionProviderOutcome => ({
          ok: false,
          requestId,
          code: 'PROVIDER_ERROR',
          message: err instanceof Error ? err.message : String(err),
          retryable: true,
        }));

        if (timeoutMs !== undefined && timeoutMs > 0) {
          // RFC-012 hardening #8: the runtime owns the timeout. Race the call so
          // a provider that ignores AbortSignal cannot hang the runtime; its late
          // completion is ignored.
          let timer: ReturnType<typeof setTimeout> | undefined;
          const timeout = new Promise<null>((resolve) => {
            timer = setTimeout(() => {
              timedOut = true;
              controller.abort();
              resolve(null);
            }, timeoutMs);
          });
          const raced = await Promise.race([call, timeout]);
          if (timer) clearTimeout(timer);
          if (raced === null) {
            void call.catch(() => undefined);
            void provider.cancel?.(requestId).catch(() => undefined);
            providerOutcome = { ok: false, requestId, code: 'TIMEOUT', message: 'Provider timed out.', retryable: true };
          } else {
            providerOutcome = raced;
          }
        } else {
          providerOutcome = await call;
        }
      } finally {
        inFlight.delete(requestId);
        if (request.signal) request.signal.removeEventListener('abort', onOuterAbort);
      }

      const durationMs = now() - startedAt;

      // Caller cancellation is terminal and never escalates (RFC-012 §27).
      if (request.signal?.aborted) {
        const attempt: DecisionAttempt = {
          providerId: provider.id,
          providerVersion: provider.version,
          startedAt,
          durationMs,
          accepted: false,
          reason: 'UNAVAILABLE',
          errorCode: 'CANCELLED',
          message: 'Cancelled by caller.',
        };
        attempts.push(attempt);
        options.onAttempt?.(attempt);
        return { ok: false, requestId, code: 'CANCELLED', message: 'Cancelled by caller.', attempts, bindings: requestBindings };
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
        if (timedOut && route.escalateOnTimeout === false) {
          return { ok: false, requestId, code: 'TIMEOUT', message: providerOutcome.message, attempts, bindings: requestBindings };
        }
        continue;
      }

      // Validate + normalize against the offered candidate space.
      let decision: DecisionResult;
      try {
        decision = validateProviderDecision(providerRequest, providerOutcome.decision);
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

      if (timedOut) {
        const attempt: DecisionAttempt = {
          providerId: provider.id,
          providerVersion: provider.version,
          startedAt,
          durationMs,
          accepted: false,
          reason: 'TIMEOUT',
          errorCode: 'TIMEOUT',
          message: 'Provider timed out.',
        };
        attempts.push(attempt);
        options.onAttempt?.(attempt);
        if (route.escalateOnTimeout === false) {
          return { ok: false, requestId, code: 'TIMEOUT', message: 'Provider timed out.', attempts, bindings: requestBindings };
        }
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

      // RFC-012 hardening #9: prefer call-specific provenance (underlying model /
      // runtime) over static provider info; the runtime-known provider identity is
      // kept distinct in `provider`.
      const provenance = providerOutcome.provenance;
      const model = provenance?.model ?? provider.info?.model;
      const runtime = provenance?.runtime ?? provider.info?.runtime;

      const receipt = createDecisionReceipt({
        version: 1,
        requestId,
        provider: { id: provider.id, version: provider.version },
        ...(model ? { model } : {}),
        ...(runtime ? { runtime } : {}),
        stateDigest: bindings.stateDigest,
        candidateSetDigest: bindings.candidateSetDigest,
        requestDigest: bindings.requestDigest,
        outputDigest,
        decisionKind: decision.kind,
        issuedAt: now(),
        durationMs,
        ...(finalConfidence !== undefined ? { confidence: finalConfidence } : {}),
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
        ...(provenance ? { provenance } : {}),
        ...(providerOutcome.upstreamRequestId ? { upstreamRequestId: providerOutcome.upstreamRequestId } : {}),
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
    const provider = inFlight.get(requestId);
    if (!provider?.cancel) {
      return { ok: false, requestId, code: 'NOT_IMPLEMENTED', message: 'No cancellable operation for request id.', retryable: false };
    }
    return provider.cancel(requestId);
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

  return { decide, cancel, close };
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

export type { DecisionAcceptanceRule, DecisionFailure };
