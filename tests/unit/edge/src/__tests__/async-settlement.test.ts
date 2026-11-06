/**
 * RFC-022 Amendment A — AgentEdgeRuntime settlement regressions.
 *
 * These tests pin the governed-action boundary: accepted/unknown holds,
 * confirmed commits, not-dispatched releases, and a dispatched failure settles
 * partial actual consumption instead of aborting as if nothing ran.
 */

import {
  createEdgeActionRegistry,
  type EdgeActionDefinition,
  type EdgeExecutionResult,
} from '../action-registry.js';
import { createAgentEdgeRuntime } from '../agent-runtime.js';
import { createCapabilitySet } from '../capabilities.js';
import type { GrantBoundAutonomyPolicy, SettlementInstructionV1 } from '@totemsdk/agent-policy';

const ACTUAL = {
  schema: 'totem:act:actual-consumption/v1' as const,
  spends: [{ tokenId: '0x00', amount: '400' }],
  fees: [],
  mandateUsage: [{ mandateId: 'mandate-1', count: 1, amount: '400' }],
  evidenceRefs: ['meter:1'],
  measuredAt: 1500,
  measurementStatus: 'verified' as const,
};

function makePolicy() {
  const commit = jest.fn().mockResolvedValue({});
  const abort = jest.fn().mockResolvedValue(undefined);
  const settleActual = jest.fn(async (instruction: SettlementInstructionV1) => ({
    settlementId: instruction.settlementId,
    terminalOutcome: instruction.terminalOutcome,
    dispatchState: instruction.dispatchState,
  }));
  const policy = {
    authorizeAndReserve: jest.fn(async () => ({
      outcome: 'approved' as const,
      reservationId: 'res-1',
      actionDigest: 'digest-1',
      decisionIds: [],
      mandateIds: ['mandate-1'],
      usageDeltas: [{ mandateId: 'mandate-1', delta: { count: 1, amount: '1000' } }],
      reservedAt: 1000,
      expiresAt: 2000,
    })),
    commit,
    abort,
    settleActual,
  };
  return { policy: policy as unknown as GrantBoundAutonomyPolicy, commit, abort, settleActual };
}

function makeRuntime(
  execute: (prepared: unknown) => Promise<EdgeExecutionResult>,
  executionMode: 'synchronous' | 'asynchronous',
) {
  const { policy, commit, abort, settleActual } = makePolicy();
  const registry = createEdgeActionRegistry();
  const def: EdgeActionDefinition = {
    capability: 'industrial:action',
    effect: 'write',
    executionMode,
    prepare: () => ({ operationId: 'op-1', preparedCommandHash: 'prepared-1' }),
    deriveEffects: () => ({ spends: [{ tokenId: '0x00', amount: '1000' }], fees: [], channels: [] }),
    execute,
  };
  registry.register(def, 'test:act');
  const runtime = createAgentEdgeRuntime({
    deviceId: 'dev-1',
    capabilities: createCapabilitySet(['industrial:action']),
    registry,
    policy,
    runId: 'run-1',
    principal: 'principal-1',
    agentId: 'agent-1',
  });
  return { runtime, commit, abort, settleActual };
}

describe('RFC-022 Amendment A AgentEdgeRuntime settlement', () => {
  it('holds an accepted async operation instead of committing', async () => {
    const { runtime, commit, abort } = makeRuntime(
      async () => ({ ok: true, data: { job: 'j-1' }, dispatchState: 'dispatched', phase: 'accepted', operationId: 'op-1' }),
      'asynchronous',
    );

    const result = await runtime.executeAction({ action: 'test:act', subject: 'target' });

    expect(result.ok).toBe(true);
    expect(result.phase).toBe('accepted');
    expect(result.dispatchState).toBe('dispatched');
    expect(result.reservationId).toBe('res-1');
    expect(commit).not.toHaveBeenCalled();
    expect(abort).not.toHaveBeenCalled();
  });

  it('holds an unknown outcome and reports EXECUTION_UNCERTAIN', async () => {
    const { runtime, commit, abort } = makeRuntime(
      async () => ({ ok: false, dispatchState: 'unknown', terminalOutcome: 'unknown', error: 'lost ack' }),
      'asynchronous',
    );

    const result = await runtime.executeAction({ action: 'test:act', subject: 'target' });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('EXECUTION_UNCERTAIN');
    expect(commit).not.toHaveBeenCalled();
    expect(abort).not.toHaveBeenCalled();
  });

  it('commits a confirmed synchronous result', async () => {
    const { runtime, commit } = makeRuntime(
      async () => ({ ok: true, data: { done: true }, dispatchState: 'dispatched', terminalOutcome: 'confirmed' }),
      'synchronous',
    );

    const result = await runtime.executeAction({ action: 'test:act', subject: 'target' });

    expect(result.ok).toBe(true);
    expect(result.terminalOutcome).toBe('confirmed');
    expect(commit).toHaveBeenCalledWith({ reservationId: 'res-1', executionProof: { done: true } });
  });

  it('releases a proven not-dispatched failure', async () => {
    const { runtime, abort, commit } = makeRuntime(
      async () => ({ ok: false, dispatchState: 'not-dispatched', terminalOutcome: 'failed', error: 'guard rejected' }),
      'synchronous',
    );

    const result = await runtime.executeAction({ action: 'test:act', subject: 'target' });

    expect(result.ok).toBe(false);
    expect(abort).toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it('settles verified actual consumption after a dispatched failure', async () => {
    const { runtime, settleActual, abort, commit } = makeRuntime(
      async () => ({
        ok: false,
        dispatchState: 'dispatched',
        terminalOutcome: 'failed',
        error: 'worker failed',
        actualConsumption: ACTUAL,
      }),
      'asynchronous',
    );

    const result = await runtime.executeAction({ action: 'test:act', subject: 'target' });

    expect(result.ok).toBe(false);
    expect(settleActual).toHaveBeenCalledTimes(1);
    const instruction = settleActual.mock.calls[0][0];
    expect(instruction.disposition).toBe('settle-actual');
    expect(instruction.terminalOutcome).toBe('failed');
    expect(instruction.actual).toEqual(ACTUAL);
    expect(instruction.operationId).toBe('op-1');
    expect(instruction.preparedCommandDigest).toBe('prepared-1');
    expect(abort).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it('conservatively charges the reservation when a dispatched failure has no meter', async () => {
    const { runtime, settleActual, abort, commit } = makeRuntime(
      async () => ({ ok: false, dispatchState: 'dispatched', terminalOutcome: 'failed', error: 'no meter' }),
      'asynchronous',
    );

    await runtime.executeAction({ action: 'test:act', subject: 'target' });

    expect(settleActual).not.toHaveBeenCalled();
    expect(abort).not.toHaveBeenCalled();
    expect(commit).toHaveBeenCalled();
  });

  it('holds a duplicate OPERATION_PENDING result', async () => {
    const { runtime, commit, abort } = makeRuntime(
      async () => ({
        ok: false,
        dispatchState: 'dispatched',
        phase: 'running',
        errorCode: 'OPERATION_PENDING',
        error: 'operation is not terminal',
      }),
      'asynchronous',
    );

    const result = await runtime.executeAction({ action: 'test:act', subject: 'target' });

    expect(result.ok).toBe(true);
    expect(result.phase).toBe('running');
    expect(commit).not.toHaveBeenCalled();
    expect(abort).not.toHaveBeenCalled();
  });

  it('holds an async throw and releases a synchronous throw', async () => {
    const asyncRun = makeRuntime(async () => { throw new Error('worker vanished'); }, 'asynchronous');
    const asyncResult = await asyncRun.runtime.executeAction({ action: 'test:act', subject: 'target' });
    expect(asyncResult.errorCode).toBe('EXECUTION_UNCERTAIN');
    expect(asyncRun.abort).not.toHaveBeenCalled();
    expect(asyncRun.commit).not.toHaveBeenCalled();

    const syncRun = makeRuntime(async () => { throw new Error('not dispatched'); }, 'synchronous');
    await syncRun.runtime.executeAction({ action: 'test:act', subject: 'target' });
    expect(syncRun.abort).toHaveBeenCalled();
  });
});
