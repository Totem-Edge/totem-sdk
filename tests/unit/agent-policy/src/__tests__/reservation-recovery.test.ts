import { MemoryRunStateStore, type RunReservation, type RunStateSnapshot, type RunStepReceipt } from '../run-state-store.js';
import { MemoryGrantUsageStore } from '../grant-usage.js';
import { GrantBoundAutonomyPolicy } from '../grant-bound-autonomy.js';
import type { StepReceipt } from '../run.js';
import type { AuthorityIdentityResolver } from '@totemsdk/authority';

function snapshot(runId: string): RunStateSnapshot {
  return {
    runId,
    profileId: 'channel-rebalance',
    principal: 'PRINCIPAL',
    agentId: 'ag',
    grantProofIds: ['totem:mandate:owner'],
    startedAt: 0,
    totals: {
      committedSteps: 0,
      reservedSteps: 0,
      abortedSteps: 0,
      spentByToken: {},
      feesByToken: {},
      outstandingByToken: {},
      usedNonces: [],
    },
  };
}

function reservation(runId: string, stepId: string): RunReservation {
  return {
    reservationId: `res:${runId}:${stepId}:1000`,
    runId,
    stepId,
    stepAction: 'simulate',
    actionDigest: `digest-${stepId}`,
    effects: { spends: [], fees: [], channels: [{ channelId: 'ch-7', operation: 'simulate' }] },
    reservedAt: 1000,
    expiresAt: 61_000,
    status: 'reserved',
    mandateIds: ['totem:mandate:owner'],
    decisionIds: ['d1'],
    usageDeltas: [{ mandateId: 'totem:mandate:owner', delta: { count: 1 } }],
  };
}

function receipt(reservationId: string, runId: string, stepId: string): RunStepReceipt {
  return {
    reservationId,
    runId,
    stepId,
    actionDigest: `digest-${stepId}`,
    committedAt: 200_000,
    mandateIds: ['totem:mandate:owner'],
    decisionIds: ['d1'],
    effects: { spends: [{ tokenId: '0x00', amount: '100' }], fees: [], channels: [{ channelId: 'ch-7', operation: 'pay' }] },
  };
}

describe('MemoryRunStateStore — conservative reservation recovery', () => {
  it('holds budget when an expired commit leaves an unsettled reservation', async () => {
    const store = new MemoryRunStateStore({ now: () => 200_000 });
    await store.createRun(snapshot('run-1'));
    await store.reserveStep(reservation('run-1', 's1'));
    await expect(store.commitStep('res:run-1:s1:1000', receipt('res:run-1:s1:1000', 'run-1', 's1')))
      .rejects.toThrow('has expired');

    expect((await store.getReservation('res:run-1:s1:1000'))?.status).toBe('unknown');
    expect((await store.getRun('run-1'))?.totals.reservedSteps).toBe(1);
    expect((await store.getRun('run-1'))?.totals.abortedSteps).toBe(0);
    expect((await store.getRun('run-1'))?.totals.committedSteps).toBe(0);
  });

  it('recovers and settles; only explicit reconciliation releases budget', async () => {
    let now = 2000;
    const store = new MemoryRunStateStore({ now: () => now });
    await store.createRun(snapshot('run-2'));
    await store.reserveStep(reservation('run-2', 's1'));
    await store.reserveStep(reservation('run-2', 's2'));
    await store.commitStep('res:run-2:s2:1000', receipt('res:run-2:s2:1000', 'run-2', 's2'));

    now = 200_000;
    const unsettled = await store.recoverReservations('run-2');
    expect(unsettled).toHaveLength(1);
    expect(unsettled[0]).toMatchObject({ reservationId: 'res:run-2:s1:1000', kind: 'run' });

    await store.reconcileReservation('res:run-2:s1:1000', 'completed', {
      receipt: receipt('res:run-2:s1:1000', 'run-2', 's1'),
    });
    const run = await store.getRun('run-2');
    expect(run?.totals.committedSteps).toBe(2);
    expect(run?.totals.reservedSteps).toBe(0);
    expect(run?.totals.abortedSteps).toBe(0);
    expect(run?.totals.spentByToken['0x00']).toBe('200');
    expect(await store.listStepReceipts('run-2')).toHaveLength(2);
    expect(await store.recoverReservations('run-2')).toHaveLength(0);
  });

  it('cancellation does not establish zero consumption until reconciled', async () => {
    const store = new MemoryRunStateStore({ now: () => 200_000 });
    await store.createRun(snapshot('run-3'));
    await store.reserveStep(reservation('run-3', 's1'));
    await expect(store.commitStep('res:run-3:s1:1000', receipt('res:run-3:s1:1000', 'run-3', 's1')))
      .rejects.toThrow('has expired');
    await store.abortStep('res:run-3:s1:1000', 'timeout');
    expect((await store.getReservation('res:run-3:s1:1000'))?.status).toBe('unknown');
    expect((await store.getRun('run-3'))?.totals.reservedSteps).toBe(1);
    expect((await store.getRun('run-3'))?.totals.abortedSteps).toBe(0);
  });
});

describe('MemoryGrantUsageStore — conservative grant recovery', () => {
  it('holds grant usage until explicit reconciliation after expiry', async () => {
    const store = new MemoryGrantUsageStore({ now: () => 200_000, ttlMs: 60_000 });
    const auth = await store.authorizeAndReserve({
      runId: 'run-1', stepId: 's-g', mandateId: 'm1', actionDigest: 'd1',
      usageDelta: { count: 1 }, now: 1000,
    });
    await expect(store.commit(auth.reservationId, {
      reservationId: auth.reservationId, runId: 'run-1', stepId: 's-g', mandateId: 'm1',
      actionDigest: 'd1', committedAt: 200_000,
    } as StepReceipt)).rejects.toThrow('has expired');

    expect(await store.countUnknown('run-1')).toBe(1);
    expect(await store.countReserved('run-1')).toBe(0);
    expect(await store.countCommitted('run-1')).toBe(0);
    expect(await store.recoverReservations('run-1')).toHaveLength(1);

    await store.reconcileReservation(auth.reservationId, 'completed');
    expect(await store.listCommittedReceipts('m1')).toHaveLength(1);
    expect(await store.countUnknown('run-1')).toBe(0);
  });

  it('only definitely-not-executed reconciliation releases grant budget', async () => {
    const store = new MemoryGrantUsageStore({ now: () => 200_000, ttlMs: 60_000 });
    const auth = await store.authorizeAndReserve({
      runId: 'run-1', stepId: 's-g2', mandateId: 'm1', actionDigest: 'd2',
      usageDelta: { count: 1 }, now: 1000,
    });
    await expect(store.commit(auth.reservationId, {
      reservationId: auth.reservationId, runId: 'run-1', stepId: 's-g2', mandateId: 'm1',
      actionDigest: 'd2', committedAt: 200_000,
    } as StepReceipt)).rejects.toThrow('has expired');
    expect(await store.countUnknown('run-1')).toBe(1);

    await store.reconcileReservation(auth.reservationId, 'definitely-not-executed');
    expect(await store.countUnknown('run-1')).toBe(0);
    expect(await store.countAborted('run-1')).toBe(1);
    expect(await store.listCommittedReceipts('m1')).toHaveLength(0);
  });
});

describe('GrantBoundAutonomyPolicy — no silent ephemeral downgrade', () => {
  const resolver = { resolve: () => undefined } as unknown as AuthorityIdentityResolver;

  it('refuses construction without a durable stateStore or explicit ephemeral mode', () => {
    expect(() => new GrantBoundAutonomyPolicy({
      autonomyProfiles: {},
      mandateResolver: async () => undefined,
      identityResolver: resolver,
    })).toThrow(/requires a durable stateStore|ephemeral/);
  });

  it('permits the in-memory store only under explicit ephemeral mode', async () => {
    const policy = new GrantBoundAutonomyPolicy({
      autonomyProfiles: {},
      mandateResolver: async () => undefined,
      identityResolver: resolver,
      ephemeral: true,
    });
    await expect(policy.openRun({
      runId: 'run-1', agentId: 'ag', principal: 'PRINCIPAL', grantProofIds: [], profileId: 'nope',
    })).rejects.toThrow(/unknown autonomy profile/);
  });

  it('exposes the recovery surface over the injected store', async () => {
    const stateStore = new MemoryRunStateStore({ now: () => 200_000 });
    const policy = new GrantBoundAutonomyPolicy({
      autonomyProfiles: {},
      mandateResolver: async () => undefined,
      identityResolver: resolver,
      stateStore,
    });
    await stateStore.createRun(snapshot('run-1'));
    await stateStore.reserveStep(reservation('run-1', 's1'));
    const unsettled = await policy.recoverReservations('run-1');
    expect(unsettled).toHaveLength(1);
    await policy.reconcileReservation('res:run-1:s1:1000', 'definitely-not-executed');
    expect(await policy.recoverReservations('run-1')).toHaveLength(0);
    expect((await policy.getRun('run-1'))?.totals.reservedSteps).toBe(0);
  });
});