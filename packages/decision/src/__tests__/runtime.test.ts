import { createDecisionRuntime } from '../runtime.js';
import { createMockDecisionProvider } from '../testing/mock-provider.js';
import { verifyDecisionReceiptId } from '../receipts.js';
import type {
  DecisionProvider,
  DecisionProviderOutcome,
  DecisionProviderRequest,
  DecisionResult,
  QuestionDecisionRequest,
} from '../types.js';

function choiceRequest(requestId = 'req-1'): QuestionDecisionRequest {
  return {
    kind: 'questions',
    requestId,
    state: { temperature: 21 },
    questions: [{ type: 'choice', id: 'q1', criteria: [{ id: 'heat' }, { id: 'cool' }] }],
  };
}

function choiceDecision(selected: string): DecisionResult {
  return { kind: 'questions', answers: [{ type: 'choice', questionId: 'q1', selected }] };
}

function staticProvider(id: string, selected: string, confidence?: number): DecisionProvider {
  return createMockDecisionProvider({
    id,
    decide: (req: DecisionProviderRequest): DecisionProviderOutcome => ({
      ok: true,
      requestId: req.requestId,
      decision: choiceDecision(selected),
      ...(confidence !== undefined ? { confidence: { value: confidence, source: 'provider' as const } } : {}),
    }),
  });
}

describe('createDecisionRuntime', () => {
  it('accepts a valid single-provider decision and certifies bindings + receipt', async () => {
    const runtime = createDecisionRuntime({ routes: [{ provider: staticProvider('p1', 'heat') }] });
    const outcome = await runtime.decide(choiceRequest());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.provider).toEqual({ id: 'p1', version: '0.0.0' });
    expect(outcome.bindings.requestDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(outcome.bindings.outputDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyDecisionReceiptId(outcome.receipt)).toBe(true);
    expect(outcome.receipt.receiptId).toMatch(/^[0-9a-f]{64}$/);
    expect(outcome.attempts).toHaveLength(1);
    expect(outcome.attempts[0]).toMatchObject({ providerId: 'p1', accepted: true });
  });

  it('ignores fake bindings/receipt supplied by a provider (trust boundary)', async () => {
    const provider = createMockDecisionProvider({
      id: 'malicious',
      decide: (req) => ({
        ok: true,
        requestId: req.requestId,
        decision: choiceDecision('heat'),
        bindings: { stateDigest: 'FAKE', candidateSetDigest: 'FAKE', requestDigest: 'FAKE', outputDigest: 'FAKE' },
        receipt: { receiptId: 'FAKE' },
      } as never),
    });
    const runtime = createDecisionRuntime({ routes: [{ provider }] });
    const outcome = await runtime.decide(choiceRequest());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.bindings.requestDigest).not.toBe('FAKE');
    expect(outcome.receipt.receiptId).not.toBe('FAKE');
    expect(verifyDecisionReceiptId(outcome.receipt)).toBe(true);
  });

  it('escalates on low confidence and records the attempt chain', async () => {
    const runtime = createDecisionRuntime({
      routes: [
        { provider: staticProvider('low', 'heat', 0.2), accept: { minConfidence: 0.9 } },
        { provider: staticProvider('high', 'cool', 0.95) },
      ],
    });
    const outcome = await runtime.decide(choiceRequest());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.decision).toEqual(choiceDecision('cool'));
    expect(outcome.attempts.map((a) => a.providerId)).toEqual(['low', 'high']);
    expect(outcome.attempts[0].reason).toBe('LOW_CONFIDENCE');
    expect(outcome.attempts[1].accepted).toBe(true);
  });

  it('escalates on invalid provider output', async () => {
    const bad = createMockDecisionProvider({
      id: 'bad',
      decide: (req) => ({ ok: true, requestId: req.requestId, decision: choiceDecision('invented') }),
    });
    const runtime = createDecisionRuntime({ routes: [{ provider: bad }, { provider: staticProvider('good', 'heat') }] });
    const outcome = await runtime.decide(choiceRequest());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.attempts[0].reason).toBe('INVALID_OUTPUT');
    expect(outcome.attempts[0].errorCode).toBe('INVALID_CANDIDATE');
  });

  it('returns NO_ACCEPTABLE_RESULT when every route fails', async () => {
    const unavailable = createMockDecisionProvider({
      id: 'down',
      decide: (req) => ({ ok: false, requestId: req.requestId, code: 'UNAVAILABLE', message: 'nope', retryable: true }),
    });
    const runtime = createDecisionRuntime({ routes: [{ provider: unavailable }] });
    const outcome = await runtime.decide(choiceRequest());
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe('NO_ACCEPTABLE_RESULT');
    expect(outcome.attempts).toHaveLength(1);
    expect(outcome.attempts[0].reason).toBe('UNAVAILABLE');
  });

  it('skips ineligible routes with recorded reasons', async () => {
    const notReady = createMockDecisionProvider({ id: 'notready', isReady: false, decision: choiceDecision('heat') });
    const runtime = createDecisionRuntime({ routes: [{ provider: notReady }, { provider: staticProvider('ok', 'heat') }] });
    const outcome = await runtime.decide(choiceRequest());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.attempts[0]).toMatchObject({ providerId: 'notready', skipped: true, reason: 'UNAVAILABLE' });
  });

  it('skips a route whose declared types do not cover the request', async () => {
    const runtime = createDecisionRuntime({
      routes: [{ provider: staticProvider('onlychoice', 'heat'), types: ['score'] }, { provider: staticProvider('ok', 'heat') }],
    });
    const outcome = await runtime.decide(choiceRequest());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.attempts[0]).toMatchObject({ skipped: true, reason: 'INELIGIBLE' });
  });

  it('enforces route limits before invoking a provider', async () => {
    let called = false;
    const provider = createMockDecisionProvider({
      id: 'limited',
      decide: (req) => {
        called = true;
        return { ok: true, requestId: req.requestId, decision: choiceDecision('heat') };
      },
    });
    const runtime = createDecisionRuntime({ routes: [{ provider, maxCandidatesPerQuestion: 1 }] });
    const outcome = await runtime.decide(choiceRequest());
    expect(called).toBe(false);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.attempts[0]).toMatchObject({ skipped: true, reason: 'LIMIT_EXCEEDED' });
  });

  it('continues to the next route after a timeout, but can be configured not to', async () => {
    const slow = createMockDecisionProvider({
      id: 'slow',
      decide: (req) =>
        new Promise<DecisionProviderOutcome>((resolve) => {
          req.signal?.addEventListener('abort', () => resolve({ ok: true, requestId: req.requestId, decision: choiceDecision('heat') }), { once: true });
        }),
    });
    const continued = await createDecisionRuntime({
      routes: [{ provider: slow, timeoutMs: 20 }, { provider: staticProvider('fast', 'cool') }],
    }).decide(choiceRequest('t1'));
    expect(continued.ok).toBe(true);
    if (continued.ok) {
      expect(continued.attempts[0].reason).toBe('TIMEOUT');
      expect(continued.provider.id).toBe('fast');
    }

    const stopped = await createDecisionRuntime({
      routes: [{ provider: slow, timeoutMs: 20, escalateOnTimeout: false }],
    }).decide(choiceRequest('t2'));
    expect(stopped.ok).toBe(false);
    if (!stopped.ok) expect(stopped.code).toBe('TIMEOUT');
  });

  it('treats caller cancellation as terminal and never escalates', async () => {
    const controller = new AbortController();
    let secondCalled = false;
    const slow = createMockDecisionProvider({
      id: 'slow',
      decide: (req) =>
        new Promise<DecisionProviderOutcome>((resolve) => {
          req.signal?.addEventListener('abort', () => resolve({ ok: true, requestId: req.requestId, decision: choiceDecision('heat') }), { once: true });
        }),
    });
    const second = createMockDecisionProvider({
      id: 'second',
      decide: (req) => {
        secondCalled = true;
        return { ok: true, requestId: req.requestId, decision: choiceDecision('cool') };
      },
    });
    const runtime = createDecisionRuntime({ routes: [{ provider: slow }, { provider: second }] });
    const pending = runtime.decide({ ...choiceRequest('c1'), signal: controller.signal });
    await Promise.resolve();
    controller.abort();
    const outcome = await pending;
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.code).toBe('CANCELLED');
    expect(secondCalled).toBe(false);
  });

  it('requires every batched answer to meet minConfidence', async () => {
    const twoQuestionDecision = (): DecisionResult => ({
      kind: 'questions',
      answers: [
        { type: 'choice', questionId: 'q1', selected: 'heat', confidence: { value: 0.99, source: 'provider' } },
        { type: 'choice', questionId: 'q2', selected: 'cool', confidence: { value: 0.4, source: 'provider' } },
      ],
    });
    const provider = createMockDecisionProvider({
      id: 'batched',
      decide: (req) => ({ ok: true, requestId: req.requestId, decision: twoQuestionDecision() }),
    });
    const runtime = createDecisionRuntime({ routes: [{ provider, accept: { minConfidence: 0.9 } }] });
    const outcome = await runtime.decide({
      kind: 'questions',
      requestId: 'b1',
      state: {},
      questions: [
        { type: 'choice', id: 'q1', criteria: [{ id: 'heat' }, { id: 'cool' }] },
        { type: 'choice', id: 'q2', criteria: [{ id: 'heat' }, { id: 'cool' }] },
      ],
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.code).toBe('NO_ACCEPTABLE_RESULT');
  });

  it('omits raw provider output by default and includes it when enabled', async () => {
    const provider = createMockDecisionProvider({
      id: 'raw',
      decide: (req) => ({ ok: true, requestId: req.requestId, decision: choiceDecision('heat'), rawProviderOutput: { secret: 'logits' } }),
    });
    const off = await createDecisionRuntime({ routes: [{ provider }] }).decide(choiceRequest('r1'));
    expect(off.ok && off.rawProviderOutput).toBeFalsy();
    const on = await createDecisionRuntime({ routes: [{ provider }], includeRawProviderOutput: true }).decide(choiceRequest('r2'));
    expect(on.ok && on.rawProviderOutput).toEqual({ secret: 'logits' });
  });

  it('delegates cancel to the active provider', async () => {
    let resolveDecide: ((o: DecisionProviderOutcome) => void) | undefined;
    let cancelCalled = false;
    const provider = createMockDecisionProvider({
      id: 'cancellable',
      decide: (req) => new Promise<DecisionProviderOutcome>((resolve) => { resolveDecide = resolve; void req; }),
      cancel: (requestId) => {
        cancelCalled = true;
        resolveDecide?.({ ok: true, requestId, decision: choiceDecision('heat') });
        return { ok: true, requestId };
      },
    });
    const runtime = createDecisionRuntime({ routes: [{ provider }] });
    const pending = runtime.decide(choiceRequest('fixed-id'));
    await Promise.resolve();
    const cancelled = await runtime.cancel?.('fixed-id');
    expect(cancelCalled).toBe(true);
    expect(cancelled?.ok).toBe(true);
    await pending;
  });

  it('defaults missing request ids and rejects malformed requests', async () => {
    const runtime = createDecisionRuntime({ routes: [{ provider: staticProvider('p', 'heat') }] });
    const outcome = await runtime.decide({ kind: 'questions', state: {}, questions: [{ type: 'choice', id: 'q1', criteria: [{ id: 'heat' }, { id: 'cool' }] }] });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.requestId).toMatch(/^decision-/);

    const bad = await runtime.decide({ kind: 'questions', state: NaN, questions: [{ type: 'choice', id: 'q1', criteria: [{ id: 'a' }] }] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.code).toBe('NON_FINITE_NUMBER');
  });
});
