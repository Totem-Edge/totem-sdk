import { createDecisionRuntime } from '../runtime.js';
import { createMockDecisionProvider } from '../testing/mock-provider.js';
import {
  toDecisionRef,
  verifyDecisionRef,
  toDecisionRefRecord,
  isDecisionRefFreshResult,
} from '../decision-ref.js';
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

function staticProvider(id: string, selected: string): DecisionProvider {
  return createMockDecisionProvider({
    id,
    decide: (req: DecisionProviderRequest): DecisionProviderOutcome => ({
      ok: true,
      requestId: req.requestId,
      decision: choiceDecision(selected),
    }),
  });
}

async function decideOnce(providerId: string, requestId: string) {
  const runtime = createDecisionRuntime({ routes: [{ provider: staticProvider(providerId, 'heat') }] });
  const outcome = await runtime.decide(choiceRequest(requestId));
  if (!outcome.ok) throw new Error('expected decision success');
  return outcome;
}

describe('RFC-017 DecisionRef (decision receipt graph)', () => {
  it('builds a ref from a DecisionSuccess that verifies against its receipt', async () => {
    const success = await decideOnce('p1', 'req-ref');
    const ref = toDecisionRef(success);

    expect(ref.kind).toBe('decision');
    expect(ref.receiptId).toBe(success.receipt.receiptId);
    expect(ref.decisionKind).toBe(success.receipt.decisionKind);
    expect(ref.providerId).toBe('p1');
    expect(ref.issuedAt).toBe(success.receipt.issuedAt);
    expect(ref.requestDigest).toBe(success.bindings.requestDigest);
    expect(ref.stateDigest).toBe(success.bindings.stateDigest);
    expect(ref.candidateSetDigest).toBe(success.bindings.candidateSetDigest);
    expect(ref.outputDigest).toBe(success.bindings.outputDigest);

    expect(verifyDecisionRef(ref, success.receipt)).toBe(true);
    expect(toDecisionRefRecord(ref, success.receipt).verification).toBe('verified');
  });

  it('marks a ref unverified when the receipt does not match', async () => {
    const a = await decideOnce('p1', 'req-a');
    const b = await decideOnce('p2', 'req-b');
    const refA = toDecisionRef(a);

    expect(verifyDecisionRef(refA, b.receipt)).toBe(false);
    expect(toDecisionRefRecord(refA, b.receipt).verification).toBe('unverified');
  });

  it('marks a ref unverified when no receipt is available', async () => {
    const success = await decideOnce('p1', 'req-nor');
    const ref = toDecisionRef(success);
    expect(toDecisionRefRecord(ref).verification).toBe('unverified');
  });

  it('detects a tampered digest as an unverified (forged) ref', async () => {
    const success = await decideOnce('p1', 'req-tamper');
    const ref = { ...toDecisionRef(success), outputDigest: 'deadbeef' };
    expect(verifyDecisionRef(ref, success.receipt)).toBe(false);
  });

  it('reports freshness against the current request', async () => {
    const request = choiceRequest('req-fresh');
    const runtime = createDecisionRuntime({ routes: [{ provider: staticProvider('p1', 'heat') }] });
    const outcome = await runtime.decide(request);
    if (!outcome.ok) throw new Error('expected decision success');

    expect(isDecisionRefFreshResult(outcome, request)).toBe(true);
    expect(isDecisionRefFreshResult(outcome, choiceRequest('req-fresh'))).toBe(true);

    const changed: QuestionDecisionRequest = { ...request, state: { temperature: 99 } };
    expect(isDecisionRefFreshResult(outcome, changed)).toBe(false);
  });
});
