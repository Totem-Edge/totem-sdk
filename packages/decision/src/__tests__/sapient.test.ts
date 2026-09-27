import { createLayaDecisionProvider } from '../adapters/laya.js';
import { createDecisionRuntime } from '../runtime.js';
import { computeDecisionBindings, isDecisionFresh } from '../canonical.js';
import type { DecisionClientQuestion } from '../typed-backend.js';
import type { DecisionRequest } from '../types.js';

/**
 * RFC-012 hardening #11 — SAPIENT-style acceptance fixture.
 *
 * Asserts the whole semantic chain: the Laya client receives the goal, state,
 * operation meaning and target meaning; the provider selects FOLLOW → track-24;
 * the runtime retains the operation/target distributions, model provenance and
 * exact bindings; and the result remains a proposal only.
 */
describe('SAPIENT acceptance fixture', () => {
  it('preserves goal/state/candidate semantics, target distribution and provenance end-to-end', async () => {
    let receivedState: unknown;
    let receivedQuestions: DecisionClientQuestion[] = [];

    const provider = createLayaDecisionProvider({
      model: 'laya-typed',
      info: { runtime: { id: 'mlx' } },
      client: {
        async predict({ state, questions }) {
          receivedState = state;
          receivedQuestions = [...questions];
          return {
            upstreamRequestId: 'up-1',
            predictions: {
              __operation: { selected: 'FOLLOW', probabilities: { FOLLOW: 0.7, WAIT: 0.3 }, confidence: 0.7 },
              '__target:FOLLOW': { selected: 'track-24', probabilities: { 'track-17': 0.52, 'track-24': 0.94 }, confidence: 0.94 },
            },
          };
        },
      },
    });

    const runtime = createDecisionRuntime({ routes: [{ provider, accept: { minTargetConfidence: 0.8 } }] });

    const request: DecisionRequest = {
      kind: 'action',
      requestId: 'sap-1',
      state: { tracks: [{ id: 'track-17' }, { id: 'track-24' }] },
      goal: 'Maintain custody of the highest-risk track',
      operations: [
        {
          id: 'FOLLOW',
          description: 'Follow a track',
          targets: [
            { id: 'track-17', description: 'UAV moving north', metadata: { confidence: 0.52 } },
            { id: 'track-24', description: 'UAV moving toward protected zone', metadata: { confidence: 0.94 } },
          ],
        },
        { id: 'LOOK_AT', targets: [{ id: 'sector-a' }, { id: 'sector-b' }] },
        { id: 'WAIT' },
      ],
    };

    const outcome = await runtime.decide(request);

    // The client received the full semantic request.
    expect(receivedState).toEqual(request.state);
    const opHead = receivedQuestions.find((q) => q.id === '__operation')!;
    expect(opHead.instruction).toBe('Maintain custody of the highest-risk track');
    expect(opHead.candidates?.[0]).toMatchObject({ id: 'FOLLOW', description: 'Follow a track' });
    const targetHead = receivedQuestions.find((q) => q.id === '__target:FOLLOW')!;
    expect(targetHead.candidates?.[1]).toMatchObject({ id: 'track-24', description: 'UAV moving toward protected zone' });

    // The runtime retained the full decision + provenance + exact bindings.
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.decision).toEqual({
      kind: 'action',
      answer: {
        type: 'action',
        operation: 'FOLLOW',
        target: 'track-24',
        operationProbabilities: { FOLLOW: 0.7, WAIT: 0.3 },
        targetProbabilities: { 'track-17': 0.52, 'track-24': 0.94 },
        confidence: { value: 0.7, source: 'provider' },
      },
    });
    expect(outcome.provider).toEqual({ id: 'laya', version: '0.0.0' });
    expect(outcome.receipt.model?.id).toBe('laya-typed');
    expect(outcome.receipt.runtime?.id).toBe('mlx');
    expect(outcome.upstreamRequestId).toBe('up-1');
    expect(outcome.bindings.requestDigest).toBe(computeDecisionBindings(request).requestDigest);
    expect(isDecisionFresh(outcome, request)).toBe(true);

    // Proposal only: no authority/execution surface.
    expect((outcome as unknown as Record<string, unknown>).execute).toBeUndefined();
    expect((outcome as unknown as Record<string, unknown>).authorize).toBeUndefined();
  });
});
