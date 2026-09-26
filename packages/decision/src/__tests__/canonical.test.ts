import {
  assertDecisionValue,
  isDecisionValue,
  computeStateDigest,
  computeCandidateSetDigest,
  computeDecisionBindings,
  isDecisionFresh,
  assertDecisionFresh,
  stateByteLength,
} from '../canonical.js';
import { DecisionError } from '../errors.js';
import type { QuestionDecisionRequest } from '../types.js';

function choiceRequest(overrides: Partial<QuestionDecisionRequest> = {}): QuestionDecisionRequest {
  return {
    kind: 'questions',
    state: { temperature: 21, door: 'closed' },
    questions: [
      {
        type: 'choice',
        id: 'q1',
        criteria: [{ id: 'heat' }, { id: 'cool' }, { id: 'hold' }],
      },
    ],
    ...overrides,
  };
}

describe('canonical values', () => {
  it('accepts canonical scalars, arrays, and objects', () => {
    expect(() => assertDecisionValue({ a: 1, b: ['x', true, null] })).not.toThrow();
    expect(isDecisionValue({ nested: { ok: 1 } })).toBe(true);
  });

  it('rejects NaN and Infinity', () => {
    expect(() => assertDecisionValue(NaN)).toThrow(DecisionError);
    expect(() => assertDecisionValue({ x: Infinity })).toThrow(/Non-finite/);
    expect(isDecisionValue([1, -Infinity])).toBe(false);
  });

  it('rejects undefined, functions, symbols, and cycles', () => {
    expect(() => assertDecisionValue(undefined)).toThrow(DecisionError);
    expect(() => assertDecisionValue(() => 1)).toThrow(DecisionError);
    expect(() => assertDecisionValue(Symbol('x'))).toThrow(DecisionError);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => assertDecisionValue(cyclic)).toThrow(/Cyclic/);
  });

  it('rejects non-plain objects such as Date', () => {
    expect(() => assertDecisionValue({ when: new Date() })).toThrow(/Non-plain/);
  });
});

describe('digests', () => {
  it('is invariant to object key ordering', () => {
    const a = computeStateDigest({ a: 1, b: 2 });
    const b = computeStateDigest({ b: 2, a: 1 });
    expect(a).toBe(b);
  });

  it('is sensitive to candidate array ordering', () => {
    const r1 = choiceRequest();
    const r2 = choiceRequest({
      questions: [
        { type: 'choice', id: 'q1', criteria: [{ id: 'cool' }, { id: 'heat' }, { id: 'hold' }] },
      ],
    });
    expect(computeCandidateSetDigest(r1)).not.toBe(computeCandidateSetDigest(r2));
  });

  it('excludes requestId, context, and signal from the request digest', () => {
    const base = computeDecisionBindings(choiceRequest()).requestDigest;
    const withMeta = computeDecisionBindings(
      choiceRequest({
        requestId: 'abc',
        context: { agentId: 'agent-1', runId: 'run-1', metadata: { trace: 'x' } },
      }),
    ).requestDigest;
    expect(withMeta).toBe(base);
  });

  it('includes instructions and goal in the request digest', () => {
    const a = computeDecisionBindings(choiceRequest()).requestDigest;
    const b = computeDecisionBindings(
      choiceRequest({
        questions: [
          {
            type: 'choice',
            id: 'q1',
            instruction: 'prefer comfort',
            criteria: [{ id: 'heat' }, { id: 'cool' }, { id: 'hold' }],
          },
        ],
      }),
    ).requestDigest;
    expect(a).not.toBe(b);
  });

  it('reports canonical state byte length', () => {
    expect(stateByteLength({ a: 1 })).toBe('{"a":1}'.length);
  });
});

describe('freshness', () => {
  const request = choiceRequest();
  const bindings = { ...computeDecisionBindings(request), outputDigest: 'out' };

  it('is fresh for the same request', () => {
    expect(isDecisionFresh({ bindings }, request)).toBe(true);
  });

  it('is stale when state, candidates, or instructions change', () => {
    expect(isDecisionFresh({ bindings }, choiceRequest({ state: { temperature: 30 } }))).toBe(false);
    expect(
      isDecisionFresh(
        { bindings },
        choiceRequest({
          questions: [{ type: 'choice', id: 'q1', instruction: 'x', criteria: [{ id: 'heat' }, { id: 'cool' }, { id: 'hold' }] }],
        }),
      ),
    ).toBe(false);
  });

  it('assertDecisionFresh throws STALE_DECISION', () => {
    try {
      assertDecisionFresh({ bindings }, choiceRequest({ state: { temperature: 99 } }));
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DecisionError);
      expect((err as DecisionError).code).toBe('STALE_DECISION');
    }
  });
});
