import { DecisionError } from '../errors.js';
import {
  validateDecisionRequest,
  validateProviderDecision,
  validateDistribution,
  normalizedEntropy,
  deriveRequiredCapabilities,
} from '../validation.js';
import type {
  ActionDecisionRequest,
  DecisionProviderRequest,
  QuestionDecisionRequest,
} from '../types.js';

const choiceRequest: QuestionDecisionRequest = {
  kind: 'questions',
  state: { x: 1 },
  questions: [
    { type: 'choice', id: 'q1', criteria: [{ id: 'a' }, { id: 'b' }] },
    { type: 'probability', id: 'q2', proposition: 'it will rain' },
  ],
};

const actionRequest: ActionDecisionRequest = {
  kind: 'action',
  state: { x: 1 },
  operations: [
    { id: 'throttle', targets: [{ id: '3.5kw' }, { id: '1kw' }] },
    { id: 'stop' },
  ],
};

describe('validateDecisionRequest', () => {
  it('accepts a well-formed request', () => {
    expect(() => validateDecisionRequest(choiceRequest)).not.toThrow();
    expect(() => validateDecisionRequest(actionRequest)).not.toThrow();
  });

  it('rejects duplicate question ids', () => {
    expect(() =>
      validateDecisionRequest({
        kind: 'questions',
        state: {},
        questions: [
          { type: 'choice', id: 'q1', criteria: [{ id: 'a' }] },
          { type: 'choice', id: 'q1', criteria: [{ id: 'b' }] },
        ],
      }),
    ).toThrow(/Duplicate question/);
  });

  it('rejects empty candidate sets', () => {
    expect(() =>
      validateDecisionRequest({ kind: 'questions', state: {}, questions: [{ type: 'choice', id: 'q1', criteria: [] }] }),
    ).toThrow(/no candidates/);
    expect(() => validateDecisionRequest({ kind: 'action', state: {}, operations: [] })).toThrow(/no operations/);
  });

  it('rejects NaN state', () => {
    expect(() => validateDecisionRequest({ kind: 'questions', state: Number.NaN, questions: [{ type: 'choice', id: 'q1', criteria: [{ id: 'a' }] }] })).toThrow(DecisionError);
  });

  it('enforces limits', () => {
    expect(() =>
      validateDecisionRequest(
        { kind: 'questions', state: {}, questions: [{ type: 'choice', id: 'q1', criteria: [{ id: 'a' }, { id: 'b' }] }] },
        { maxCandidatesPerQuestion: 1 },
      ),
    ).toThrow(/maxCandidatesPerQuestion/);
  });

  it('derives the de-duplicated required capability union', () => {
    expect(deriveRequiredCapabilities(choiceRequest)).toEqual(['decision:choice', 'decision:probability']);
    expect(deriveRequiredCapabilities(actionRequest)).toEqual(['decision:action']);
  });
});

describe('validateDistribution', () => {
  it('accepts a complete distribution that sums to 1', () => {
    expect(() => validateDistribution({ a: 0.4, b: 0.6 }, { candidateIds: ['a', 'b'], requireComplete: true })).not.toThrow();
  });

  it('rejects a complete distribution that does not cover all candidates', () => {
    expect(() => validateDistribution({ a: 1 }, { candidateIds: ['a', 'b'], requireComplete: true })).toThrow(/cover/);
  });

  it('rejects a complete distribution whose sum is wrong', () => {
    expect(() => validateDistribution({ a: 0.4, b: 0.4 }, { candidateIds: ['a', 'b'], requireComplete: true })).toThrow(/sums/);
  });

  it('accepts partial distributions without renormalizing', () => {
    expect(() => validateDistribution({ a: 0.4 }, { candidateIds: ['a', 'b'] })).not.toThrow();
  });

  it('rejects out-of-range and unknown keys', () => {
    expect(() => validateDistribution({ a: 1.5, b: -0.5 }, { candidateIds: ['a', 'b'] })).toThrow(/outside/);
    expect(() => validateDistribution({ z: 0.5 }, { candidateIds: ['a', 'b'] })).toThrow(/not a valid candidate/);
  });

  it('computes normalized entropy in [0,1]', () => {
    expect(normalizedEntropy({ a: 1, b: 0 })).toBeCloseTo(0);
    expect(normalizedEntropy({ a: 0.5, b: 0.5 })).toBeCloseTo(1);
    expect(normalizedEntropy({ a: 1 })).toBe(0);
  });
});

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

describe('validateProviderDecision', () => {
  it('normalizes a valid questions decision', () => {
    const decision = validateProviderDecision(providerRequest, {
      kind: 'questions',
      answers: [
        { questionId: 'q1', type: 'choice', selected: 'a', probabilities: { a: 0.7, b: 0.3 }, complete: true },
        { questionId: 'q2', type: 'score', selected: 'high', distribution: { low: 0, mid: 0.2, high: 0.8 }, complete: true, expectedScore: 1.8 },
        { questionId: 'q3', type: 'probability', probabilityTrue: 0.42 },
      ],
    });
    expect(decision.kind).toBe('questions');
  });

  it('rejects an invented candidate id', () => {
    expect(() =>
      validateProviderDecision(providerRequest, {
        kind: 'questions',
        answers: [
          { questionId: 'q1', type: 'choice', selected: 'delete-everything' },
          { questionId: 'q2', type: 'score', selected: 'high' },
          { questionId: 'q3', type: 'probability', probabilityTrue: 0.1 },
        ],
      }),
    ).toThrow(/not an offered candidate/);
  });

  it('rejects a wrong-typed or duplicated answer', () => {
    expect(() =>
      validateProviderDecision(providerRequest, {
        kind: 'questions',
        answers: [
          { questionId: 'q1', type: 'probability', probabilityTrue: 0.5 },
          { questionId: 'q2', type: 'score', selected: 'high' },
          { questionId: 'q3', type: 'probability', probabilityTrue: 0.1 },
        ],
      }),
    ).toThrow(/does not match/);
    expect(() =>
      validateProviderDecision(providerRequest, {
        kind: 'questions',
        answers: [
          { questionId: 'q1', type: 'choice', selected: 'a' },
          { questionId: 'q1', type: 'choice', selected: 'b' },
          { questionId: 'q2', type: 'score', selected: 'high' },
        ],
      } as never),
    ).toThrow();
  });

  it('rejects out-of-range probabilityTrue', () => {
    expect(() =>
      validateProviderDecision(providerRequest, {
        kind: 'questions',
        answers: [
          { questionId: 'q1', type: 'choice', selected: 'a' },
          { questionId: 'q2', type: 'score', selected: 'high' },
          { questionId: 'q3', type: 'probability', probabilityTrue: 1.5 },
        ],
      }),
    ).toThrow(/outside/);
  });

  it('rejects expectedScore outside the zero-based rubric range', () => {
    expect(() =>
      validateProviderDecision(providerRequest, {
        kind: 'questions',
        answers: [
          { questionId: 'q1', type: 'choice', selected: 'a' },
          { questionId: 'q2', type: 'score', selected: 'high', expectedScore: 9 },
          { questionId: 'q3', type: 'probability', probabilityTrue: 0.5 },
        ],
      }),
    ).toThrow(/zero-based rubric/);
  });
});

const actionProviderRequest: Extract<DecisionProviderRequest, { kind: 'action' }> = {
  kind: 'action',
  requestId: 'a1',
  state: { x: 1 },
  operations: [
    { id: 'throttle', targets: [{ id: '3.5kw' }, { id: '1kw' }] },
    { id: 'stop' },
  ],
};

describe('validateProviderDecision (action)', () => {
  it('accepts a compatible operation+target', () => {
    const decision = validateProviderDecision(actionProviderRequest, {
      kind: 'action',
      answer: { operation: 'throttle', target: '3.5kw', operationProbabilities: { throttle: 0.8, stop: 0.2 } },
    });
    expect(decision.kind).toBe('action');
  });

  it('rejects an invented operation', () => {
    expect(() => validateProviderDecision(actionProviderRequest, { kind: 'action', answer: { operation: 'nuke' } })).toThrow(/not offered/);
  });

  it('rejects a target incompatible with the selected operation', () => {
    expect(() =>
      validateProviderDecision(actionProviderRequest, { kind: 'action', answer: { operation: 'throttle', target: '5mw' } }),
    ).toThrow(/not compatible/);
  });

  it('rejects a target for a targetless operation', () => {
    expect(() =>
      validateProviderDecision(actionProviderRequest, { kind: 'action', answer: { operation: 'stop', target: 'x' } }),
    ).toThrow(/no targets/);
  });
});
