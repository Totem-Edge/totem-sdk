/**
 * @totemsdk/edge — decision port routing tests (RFC-012 §33).
 */

import {
  createCapabilitySet,
  createEdgeRuntime,
  createEdgeDecisionPort,
  hasDecisionCapability,
  isDecisionCapability,
  EDGE_DECISION_CAPABILITIES,
} from '../index.js';
import type {
  EdgeCapability,
  EdgeCapabilitySet,
  EdgeDecisionPort,
  EdgeRuntimePorts,
} from '../index.js';
import {
  createDecisionRuntime,
} from '@totemsdk/decision';
import { createMockDecisionProvider } from '@totemsdk/decision/testing';
import type { DecisionRequest } from '@totemsdk/decision';

function makeDecisionPort(): EdgeDecisionPort {
  const provider = createMockDecisionProvider({
    id: 'mock-decision',
    decide: (req) => ({
      ok: true,
      requestId: req.requestId,
      decision: { kind: 'questions', answers: [{ type: 'choice', questionId: 'q1', selected: 'heat', confidence: { value: 0.9, source: 'provider' } }] },
    }),
  });
  return createEdgeDecisionPort(createDecisionRuntime({ routes: [{ provider }] }), { runtimeId: 'decision-runtime' });
}

const choiceRequest = (): DecisionRequest => ({
  kind: 'questions',
  requestId: 'req-edge-1',
  state: { temperature: 21 },
  questions: [{ type: 'choice', id: 'q1', criteria: [{ id: 'heat' }, { id: 'cool' }] }],
});

describe('edge decision capabilities', () => {
  it('advertises the four closed decision capabilities', () => {
    expect(EDGE_DECISION_CAPABILITIES).toEqual([
      'decision:choice',
      'decision:score',
      'decision:probability',
      'decision:action',
    ]);
  });

  it('labels and checks decision capabilities', () => {
    expect(isDecisionCapability('decision:choice')).toBe(true);
    expect(isDecisionCapability('intelligence:llm')).toBe(false);
    const set = createCapabilitySet(['decision:choice', 'wallet:self-custody']);
    expect(hasDecisionCapability(set, 'decision:choice')).toBe(true);
    expect(hasDecisionCapability(set, 'decision:action')).toBe(false);
  });
});

describe('edge runtime decision routing', () => {
  const capabilities: EdgeCapabilitySet = createCapabilitySet(['decision:choice', 'wallet:self-custody']);

  it('routes decision:decide to the port and returns the certified outcome', async () => {
    const runtime = createEdgeRuntime({ deviceId: 'dev-1', capabilities, ports: { decision: makeDecisionPort() } });
    const result = await runtime.executeAction({ action: 'decision:decide', subject: 'q1', payload: { request: choiceRequest() } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const outcome = result.data as { ok: boolean; receipt: { receiptId: string } };
      expect(outcome.ok).toBe(true);
      expect(outcome.receipt.receiptId).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('returns PORT_MISSING without a decision port', async () => {
    const runtime = createEdgeRuntime({ deviceId: 'dev-2', capabilities, ports: {} });
    const result = await runtime.executeAction({ action: 'decision:decide', subject: 'q1', payload: { request: choiceRequest() } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('PORT_MISSING');
  });

  it('gates on the union of required decision capabilities', async () => {
    const runtime = createEdgeRuntime({ deviceId: 'dev-3', capabilities, ports: { decision: makeDecisionPort() } });
    const result = await runtime.executeAction({
      action: 'decision:decide',
      subject: 'q1',
      payload: {
        request: {
          kind: 'questions',
          state: {},
          questions: [
            { type: 'choice', id: 'q1', criteria: [{ id: 'a' }] },
            { type: 'probability', id: 'q2', proposition: 'p' },
          ],
        } satisfies DecisionRequest,
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('CAPABILITY_MISSING');
      expect(result.error).toContain('decision:probability');
    }
  });

  it('validates the request payload shape', async () => {
    const runtime = createEdgeRuntime({ deviceId: 'dev-4', capabilities, ports: { decision: makeDecisionPort() } });
    const result = await runtime.executeAction({ action: 'decision:decide', subject: 'q1', payload: { request: { kind: 'nonsense' } } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('INVALID_REQUEST');
  });

  it('keeps decision:cancel capability-ungated', async () => {
    let cancelled: string | undefined;
    const port: EdgeDecisionPort = {
      runtimeId: 'decision-runtime',
      capabilities: ['decision:choice'],
      async decide() {
        return { ok: true };
      },
      async cancel(requestId: string) {
        cancelled = requestId;
        return { ok: true };
      },
    };
    const runtime = createEdgeRuntime({
      deviceId: 'dev-5',
      capabilities: createCapabilitySet([]),
      ports: { decision: port },
    });
    const result = await runtime.executeAction({ action: 'decision:cancel', subject: 'q1', payload: { requestId: 'req-edge-1' } });
    expect(result.ok).toBe(true);
    expect(cancelled).toBe('req-edge-1');
  });

  it('coexists with the intelligence port', async () => {
    const ports: EdgeRuntimePorts = {
      decision: makeDecisionPort(),
      intelligence: {
        providerId: 'test-probe',
        capabilities: ['intelligence:llm'],
        async invoke() {
          return { ok: true, data: { data: { text: 'hello' } } };
        },
      },
    };
    const runtime = createEdgeRuntime({
      deviceId: 'dev-6',
      capabilities: createCapabilitySet(['decision:choice', 'intelligence:llm'] as EdgeCapability[]),
      ports,
    });
    const decisionResult = await runtime.executeAction({ action: 'decision:decide', subject: 'q1', payload: { request: choiceRequest() } });
    const intelligenceResult = await runtime.executeAction({ action: 'intelligence:invoke', subject: 'llm', payload: { domain: 'llm', op: 'completion' } });
    expect(decisionResult.ok).toBe(true);
    expect(intelligenceResult.ok).toBe(true);
  });
});
