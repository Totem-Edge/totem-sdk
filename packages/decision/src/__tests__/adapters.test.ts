import { createTypedDecisionProvider, translateBackendResult } from '../typed-backend.js';
import type { DecisionClientQuestion } from '../typed-backend.js';
import { createLayaDecisionProvider } from '../adapters/laya.js';
import { createJevDecisionProvider } from '../adapters/jev.js';
import { createDecisionRuntime } from '../runtime.js';
import { createMockDecisionProvider } from '../testing/mock-provider.js';
import type {
  DecisionProviderRequest,
  DecisionResult,
  TypedDecisionBackend,
} from '../types.js';
import type { IntelligenceProvider } from '@totemsdk/intelligence';

const providerRequest: Extract<DecisionProviderRequest, { kind: 'questions' }> = {
  kind: 'questions',
  requestId: 'r1',
  state: { x: 1 },
  questions: [
    { type: 'choice', id: 'q1', criteria: [{ id: 'a' }, { id: 'b' }] },
    { type: 'score', id: 'q2', rubric: [{ id: 'low' }, { id: 'mid' }, { id: 'high' }] },
    { type: 'probability', id: 'q3', proposition: 'p' },
  ],
};

const actionRequest: Extract<DecisionProviderRequest, { kind: 'action' }> = {
  kind: 'action',
  requestId: 'a1',
  state: { x: 1 },
  operations: [
    { id: 'throttle', targets: [{ id: '3.5kw' }, { id: '1kw' }] },
    { id: 'stop' },
  ],
};

describe('createTypedDecisionProvider', () => {
  it('maps choice/score/probability predictions', async () => {
    const backend: TypedDecisionBackend = {
      id: 'backend',
      async predict() {
        return {
          predictions: {
            q1: { type: 'choice', selected: 'a', probabilities: { a: 0.7, b: 0.3 }, complete: true },
            q2: { type: 'score', selected: 'high', distribution: { low: 0, mid: 0.2, high: 0.8 }, complete: true, expectedScore: 1.8 },
            q3: { type: 'probability', probabilityTrue: 0.42 },
          },
        };
      },
    };
    const provider = createTypedDecisionProvider({ backend, id: 'typed' });
    const runtime = createDecisionRuntime({ routes: [{ provider }] });
    const outcome = await runtime.decide({
      kind: 'questions',
      requestId: 'r',
      state: { x: 1 },
      questions: providerRequest.questions,
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.decision).toEqual({
      kind: 'questions',
      answers: [
        { type: 'choice', questionId: 'q1', selected: 'a', probabilities: { a: 0.7, b: 0.3 }, complete: true },
        { type: 'score', questionId: 'q2', selected: 'high', distribution: { low: 0, mid: 0.2, high: 0.8 }, complete: true, expectedScore: 1.8 },
        { type: 'probability', questionId: 'q3', probabilityTrue: 0.42 },
      ],
    });
  });

  it('returns only the selected operation target head (unused heads ignored)', () => {
    const decision = translateBackendResult(actionRequest, {
      __action: {
        type: 'action',
        operation: 'throttle',
        operationProbabilities: { throttle: 0.8, stop: 0.2 },
        targetHeads: {
          throttle: { target: '1kw', probability: 0.6 },
          stop: { target: '3.5kw', probability: 0.99 },
        },
      },
    });
    expect(decision).toEqual({
      kind: 'action',
      answer: {
        type: 'action',
        operation: 'throttle',
        target: '1kw',
        operationProbabilities: { throttle: 0.8, stop: 0.2 },
      },
    });
  });

  it('does not apply a target head to a targetless operation', () => {
    const decision = translateBackendResult(actionRequest, {
      __action: {
        type: 'action',
        operation: 'stop',
        targetHeads: { throttle: { target: '1kw' } },
      },
    });
    expect(decision).toEqual({ kind: 'action', answer: { type: 'action', operation: 'stop' } });
  });
});

describe('Laya adapter', () => {
  it('preserves instruction, descriptions, metadata and action goal into the client call', async () => {
    let seen: DecisionClientQuestion[] = [];
    const client = {
      async predict({ questions }: { questions: readonly DecisionClientQuestion[] }) {
        seen = [...questions];
        return {
          predictions: {
            q1: { selected: 'b' },
            __operation: { selected: 'throttle' },
            '__target:throttle': { selected: '1kw' },
          },
        };
      },
    };
    const provider = createLayaDecisionProvider({ client });

    await provider.decide({
      kind: 'questions',
      requestId: 'r',
      state: {},
      questions: [
        {
          type: 'choice',
          id: 'q1',
          instruction: 'Pick a department',
          criteria: [
            { id: 'a', description: 'A desc' },
            { id: 'b', description: 'B desc', metadata: { risk: 1 } },
          ],
        },
      ],
    });
    const q1 = seen.find((q) => q.id === 'q1')!;
    expect(q1.instruction).toBe('Pick a department');
    expect(q1.candidates?.[1]).toMatchObject({ id: 'b', description: 'B desc', metadata: { risk: 1 } });

    seen = [];
    await provider.decide({
      kind: 'action',
      requestId: 'a',
      state: {},
      goal: 'Maintain service while reducing thermal risk',
      operations: [
        {
          id: 'throttle',
          description: 'Reduce charging power safely',
          targets: [{ id: '1kw', description: '7kW charging channel' }],
        },
      ],
    });
    expect(seen.find((q) => q.id === '__operation')!.instruction).toBe('Maintain service while reducing thermal risk');
    expect(seen.find((q) => q.id === '__operation')!.candidates?.[0]).toMatchObject({ id: 'throttle', description: 'Reduce charging power safely' });
    expect(seen.find((q) => q.id === '__target:throttle')!.candidates?.[0]).toMatchObject({ id: '1kw', description: '7kW charging channel' });
  });

  it('translates probability to/from noul without leaking the vocabulary', async () => {
    const seen: string[] = [];
    const provider = createLayaDecisionProvider({
      client: {
        async predict({ questions }) {
          for (const q of questions) seen.push(q.type);
          return { predictions: { q1: { selected: 'a', probabilities: { a: 0.9, b: 0.1 }, confidence: 0.8 }, q3: { selected: 'true', noul: 0.73 } } };
        },
      },
    });
    const request: DecisionProviderRequest = {
      kind: 'questions',
      requestId: 'r',
      state: {},
      questions: [
        { type: 'choice', id: 'q1', criteria: [{ id: 'a' }, { id: 'b' }] },
        { type: 'probability', id: 'q3', proposition: 'p' },
      ],
    };
    const outcome = await provider.decide(request);
    expect(seen).toContain('noul');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(JSON.stringify(outcome.decision)).not.toContain('noul');
    const probability = (outcome.decision as Extract<DecisionResult, { kind: 'questions' }>).answers[1];
    expect(probability).toMatchObject({ type: 'probability', probabilityTrue: 0.73 });
  });
});

describe('Jev adapter', () => {
  it('maps probability predictions', async () => {
    const provider = createJevDecisionProvider({
      client: {
        async predict() {
          return { predictions: { q3: { selected: 'true', probability: 0.61 } } };
        },
      },
    });
    const outcome = await provider.decide({ kind: 'questions', requestId: 'r', state: {}, questions: [{ type: 'probability', id: 'q3', proposition: 'p' }] });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect((outcome.decision as Extract<DecisionResult, { kind: 'questions' }>).answers[0]).toMatchObject({ probabilityTrue: 0.61 });
    }
  });
});

describe('intelligence fallback', () => {
  const intelligence = (data: unknown): IntelligenceProvider => ({
    id: 'mock-llm',
    displayName: 'Mock LLM',
    version: '9.9.9',
    capabilities: ['intelligence:llm'],
    isReady: true,
    invoke: async <T,>() => ({ ok: true, requestId: 'x', data: data as T }),
    invokeStream: () => { throw new Error('not implemented'); },
    cancel: async () => ({ ok: true, requestId: 'x', data: undefined }),
    close: async () => undefined,
  });

  it('accepts a well-formed generative answer', async () => {
    const { createIntelligenceDecisionProvider } = await import('../adapters/intelligence.js');
    const provider = createIntelligenceDecisionProvider({
      intelligence: intelligence({ text: JSON.stringify({ answers: [{ questionId: 'q1', type: 'choice', selected: 'a' }] }) }),
    });
    const runtime = createDecisionRuntime({ routes: [{ provider }] });
    const outcome = await runtime.decide({ kind: 'questions', requestId: 'r', state: {}, questions: [{ type: 'choice', id: 'q1', criteria: [{ id: 'a' }, { id: 'b' }] }] });
    expect(outcome.ok).toBe(true);
  });

  it('rejects an invented candidate from the model at the runtime boundary', async () => {
    const { createIntelligenceDecisionProvider } = await import('../adapters/intelligence.js');
    const provider = createIntelligenceDecisionProvider({
      intelligence: intelligence({ text: JSON.stringify({ answers: [{ questionId: 'q1', type: 'choice', selected: 'rm-rf' }] }) }),
    });
    const runtime = createDecisionRuntime({ routes: [{ provider }] });
    const outcome = await runtime.decide({ kind: 'questions', requestId: 'r', state: {}, questions: [{ type: 'choice', id: 'q1', criteria: [{ id: 'a' }, { id: 'b' }] }] });
    expect(outcome.ok).toBe(false);
  });

  it('reports malformed model output as a provider failure', async () => {
    const { createIntelligenceDecisionProvider } = await import('../adapters/intelligence.js');
    const provider = createIntelligenceDecisionProvider({ intelligence: intelligence({ text: 'I choose option a, obviously.' }) });
    const outcome = await provider.decide({ kind: 'questions', requestId: 'r', state: {}, questions: [{ type: 'choice', id: 'q1', criteria: [{ id: 'a' }] }] });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.code).toBe('INVALID_OUTPUT');
  });

  it('works as a fallback route after a failing provider', async () => {
    const { createIntelligenceDecisionProvider } = await import('../adapters/intelligence.js');
    const fallback = createIntelligenceDecisionProvider({
      intelligence: intelligence({ text: JSON.stringify({ answers: [{ questionId: 'q1', type: 'choice', selected: 'b' }] }) }),
    });
    const runtime = createDecisionRuntime({
      routes: [{ provider: createMockDecisionProvider({ id: 'down', isReady: false, decision: { kind: 'questions', answers: [] } }) }, { provider: fallback }],
    });
    const outcome = await runtime.decide({ kind: 'questions', requestId: 'r', state: {}, questions: [{ type: 'choice', id: 'q1', criteria: [{ id: 'a' }, { id: 'b' }] }] });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.provider.id).toBe('intelligence');
  });
});
