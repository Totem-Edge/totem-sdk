/**
 * RFC-012 second-order hardening regression tests.
 *
 * Covers: hard cancellation, operation/target confidence separation, action
 * distribution completeness, intelligence-fallback semantics, Edge port failure
 * provenance, capability narrowing, the closed capability set, and request-id
 * validation.
 */
import { createDecisionRuntime } from '../runtime.js';
import { createEdgeDecisionPort } from '../port.js';
import { createMockDecisionProvider } from '../testing/mock-provider.js';
import { isDecisionCapability } from '../constants.js';
import { translateBackendResult } from '../typed-backend.js';
import { buildIntelligenceDecisionPrompt } from '../adapters/intelligence.js';
import type {
  ActionDecisionRequest,
  DecisionProviderOutcome,
  DecisionProviderRequest,
  DecisionResult,
  QuestionDecisionRequest,
} from '../types.js';

function qReq(requestId?: string): QuestionDecisionRequest {
  return {
    kind: 'questions',
    ...(requestId !== undefined ? { requestId } : {}),
    state: { temperature: 21 },
    questions: [{ type: 'choice', id: 'q1', criteria: [{ id: 'heat' }, { id: 'cool' }] }],
  };
}

function choiceDecision(selected = 'heat'): DecisionResult {
  return { kind: 'questions', answers: [{ type: 'choice', questionId: 'q1', selected }] };
}

function aReq(requestId = 'a1'): ActionDecisionRequest {
  return {
    kind: 'action',
    requestId,
    state: {},
    goal: 'Maintain custody',
    operations: [
      { id: 'follow', description: 'Follow a track', targets: [{ id: 't1', description: 'target one' }, { id: 't2' }] },
      { id: 'wait' },
    ],
  };
}

const actionProviderRequest: Extract<DecisionProviderRequest, { kind: 'action' }> = {
  kind: 'action',
  requestId: 'a',
  state: {},
  operations: [{ id: 'throttle', targets: [{ id: '1kw' }, { id: '3.5kw' }] }],
};

// ── #1 hard cancellation ───────────────────────────────────────────────────

describe('hard cancellation', () => {
  it('caller abort stops the runtime even when the provider ignores its signal', async () => {
    const controller = new AbortController();
    const hanging = createMockDecisionProvider({
      id: 'hang',
      decide: () => new Promise<DecisionProviderOutcome>(() => undefined),
    });
    const runtime = createDecisionRuntime({ routes: [{ provider: hanging }] });
    const pending = runtime.decide({ ...qReq('cancel-hard'), signal: controller.signal });
    await Promise.resolve();
    controller.abort();
    const outcome = await pending;
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.code).toBe('CANCELLED');
  });

  it('runtime.cancel stops its own wait even when provider.cancel is a no-op', async () => {
    const hanging = createMockDecisionProvider({
      id: 'hang2',
      decide: () => new Promise<DecisionProviderOutcome>(() => undefined),
      cancel: (requestId) => ({ ok: true, requestId }),
    });
    const runtime = createDecisionRuntime({ routes: [{ provider: hanging }] });
    const pending = runtime.decide(qReq('hard-cancel'));
    await Promise.resolve();
    const cancelled = await runtime.cancel?.('hard-cancel');
    expect(cancelled?.ok).toBe(true);
    const outcome = await pending;
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.code).toBe('CANCELLED');
  });
});

// ── #2 operation/target confidence vs probability ──────────────────────────

describe('confidence vs probability', () => {
  it('never converts target confidence into a probability', () => {
    const decision = translateBackendResult(actionProviderRequest, {
      __action: { type: 'action', operation: 'throttle', targetHeads: { throttle: { target: '1kw', confidence: 0.9 } } },
    });
    expect(decision).toEqual({
      kind: 'action',
      answer: {
        type: 'action',
        operation: 'throttle',
        target: '1kw',
        targetConfidence: { value: 0.9, source: 'provider' },
      },
    });
  });

  it('minTargetConfidence uses target confidence, not the target probability', async () => {
    const provider = createMockDecisionProvider({
      id: 'tc',
      decide: (req) => ({
        ok: true,
        requestId: req.requestId,
        decision: {
          kind: 'action',
          answer: {
            type: 'action',
            operation: 'follow',
            target: 't1',
            targetProbabilities: { t1: 0.1, t2: 0.9 },
            targetConfidence: { value: 0.9, source: 'provider' },
          },
        },
      }),
    });
    const runtime = createDecisionRuntime({ routes: [{ provider, accept: { minTargetConfidence: 0.8 } }] });
    const outcome = await runtime.decide(aReq('conf'));
    // Low target probability (0.1) must not defeat the real head confidence.
    expect(outcome.ok).toBe(true);
  });

  it('minTargetConfidence falls back to the target probability when no confidence is given', async () => {
    const provider = createMockDecisionProvider({
      id: 'tp',
      decide: (req) => ({
        ok: true,
        requestId: req.requestId,
        decision: {
          kind: 'action',
          answer: { type: 'action', operation: 'follow', target: 't1', targetProbabilities: { t1: 0.1, t2: 0.9 } },
        },
      }),
    });
    const runtime = createDecisionRuntime({ routes: [{ provider, accept: { minTargetConfidence: 0.8 } }] });
    const outcome = await runtime.decide(aReq('prob'));
    expect(outcome.ok).toBe(false);
  });
});

// ── #3 action distribution completeness ────────────────────────────────────

describe('action distribution completeness', () => {
  function providerWith(answer: Record<string, unknown>) {
    return createMockDecisionProvider({
      id: 'dist',
      decide: (req) => ({ ok: true, requestId: req.requestId, decision: { kind: 'action', answer: answer as never } }),
    });
  }

  it('rejects a complete action target distribution that does not sum to 1', async () => {
    const runtime = createDecisionRuntime({
      routes: [{ provider: providerWith({
        type: 'action', operation: 'follow', target: 't1',
        targetProbabilities: { t1: 0.52, t2: 0.94 }, targetProbabilitiesComplete: true,
      }) }],
    });
    const outcome = await runtime.decide(aReq('bad-target'));
    expect(outcome.ok).toBe(false);
    expect(outcome.attempts[0].errorCode).toBe('INVALID_DISTRIBUTION');
  });

  it('rejects a complete operation distribution that does not sum to 1', async () => {
    const runtime = createDecisionRuntime({
      routes: [{ provider: providerWith({
        type: 'action', operation: 'follow', target: 't1',
        operationProbabilities: { follow: 0.5, wait: 0.3 }, operationProbabilitiesComplete: true,
      }) }],
    });
    const outcome = await runtime.decide(aReq('bad-op'));
    expect(outcome.ok).toBe(false);
    expect(outcome.attempts[0].errorCode).toBe('INVALID_DISTRIBUTION');
  });

  it('accepts well-formed complete action distributions', async () => {
    const runtime = createDecisionRuntime({
      routes: [{ provider: providerWith({
        type: 'action', operation: 'follow', target: 't1',
        operationProbabilities: { follow: 0.7, wait: 0.3 }, operationProbabilitiesComplete: true,
        targetProbabilities: { t1: 0.06, t2: 0.94 }, targetProbabilitiesComplete: true,
      }) }],
    });
    const outcome = await runtime.decide(aReq('good'));
    expect(outcome.ok).toBe(true);
  });
});

// ── #5 intelligence fallback semantics ─────────────────────────────────────

describe('intelligence fallback prompt', () => {
  it('preserves goal, operation/target descriptions and metadata', () => {
    const prompt = buildIntelligenceDecisionPrompt({
      kind: 'action',
      requestId: 'prompt',
      state: {},
      goal: 'Maintain custody',
      operations: [
        { id: 'follow', description: 'Follow a track', targets: [{ id: 't1', description: 'target one' }, { id: 't2' }] },
        { id: 'wait' },
      ],
    });
    expect(prompt).toContain('Maintain custody');
    expect(prompt).toContain('Follow a track');
    expect(prompt).toContain('target one');
  });

  it('preserves question instructions and criterion descriptions', () => {
    const prompt = buildIntelligenceDecisionPrompt({
      kind: 'questions',
      requestId: 'p',
      state: {},
      questions: [{
        type: 'choice',
        id: 'q1',
        instruction: 'Pick a department',
        criteria: [{ id: 'a', description: 'A desc' }, { id: 'b' }],
      }],
    });
    expect(prompt).toContain('Pick a department');
    expect(prompt).toContain('A desc');
  });
});

// ── #6 / #7 Edge port ──────────────────────────────────────────────────────

describe('edge port', () => {
  it('preserves failure attempts/bindings in the port result data', async () => {
    const provider = createMockDecisionProvider({
      id: 'down',
      decide: (req) => ({ ok: false, requestId: req.requestId, code: 'UNAVAILABLE', message: 'nope', retryable: true }),
    });
    const port = createEdgeDecisionPort(createDecisionRuntime({ routes: [{ provider }] }));
    const result = await port.decide({ request: qReq('p1') });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('NO_ACCEPTABLE_RESULT');
    const data = result.data as { attempts?: Array<{ providerId: string }> } | undefined;
    expect(data?.attempts?.[0]?.providerId).toBe('down');
  });

  it('rejects capability expansion but allows narrowing', () => {
    const provider = createMockDecisionProvider({
      id: 'choice-only',
      capabilities: ['decision:choice'],
      decision: { kind: 'questions', answers: [] },
    });
    const runtime = createDecisionRuntime({ routes: [{ provider }] });
    expect(() =>
      createEdgeDecisionPort(runtime, { capabilities: ['decision:choice', 'decision:action'] }),
    ).toThrow(/does not provide/);
    const port = createEdgeDecisionPort(runtime, { capabilities: ['decision:choice'] });
    expect(port.capabilities).toEqual(['decision:choice']);
  });
});

// ── #9 / #10 closed capabilities + request ids ─────────────────────────────

describe('capabilities and request ids', () => {
  it('isDecisionCapability is a closed set', () => {
    expect(isDecisionCapability('decision:choice')).toBe(true);
    expect(isDecisionCapability('decision:action')).toBe(true);
    expect(isDecisionCapability('decision:anything')).toBe(false);
    expect(isDecisionCapability('intelligence:llm')).toBe(false);
  });

  it('rejects an empty requestId', async () => {
    const provider = createMockDecisionProvider({ id: 'p', decision: choiceDecision() });
    const outcome = await createDecisionRuntime({ routes: [{ provider }] }).decide({ ...qReq(), requestId: '' });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.code).toBe('INVALID_REQUEST');
  });

  it('requires a requestId when generation is disabled', async () => {
    const provider = createMockDecisionProvider({ id: 'p', decision: choiceDecision() });
    const runtime = createDecisionRuntime({ routes: [{ provider }], generateRequestId: false });
    const outcome = await runtime.decide(qReq());
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.code).toBe('INVALID_REQUEST');
  });
});
