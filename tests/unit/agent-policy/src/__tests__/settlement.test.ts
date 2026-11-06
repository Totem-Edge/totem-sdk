/**
 * RFC-022 Amendment A — settlement ledger tests.
 *
 * Covers the in-memory and SQLite authorities: accepted/pending hold is tested
 * in edge/act-core; here we prove the actual-usage settlement primitive.
 */

import { MemoryRunStateStore } from '../../../../../packages/agent-policy/src/run-state-store.js';
import { MemoryGrantUsageStore } from '../../../../../packages/agent-policy/src/grant-usage.js';
import { SqliteRunStateStore } from '../../../../../packages/agent-policy/src/sqlite-run-state-store.js';
import type { RunReservation, RunStateSnapshot, RunStateStore } from '../../../../../packages/agent-policy/src/run-state-store.js';
import type { SettlementInstructionV1 } from '../../../../../packages/agent-policy/src/settlement.js';
import { computeSettlementId } from '../../../../../packages/agent-policy/src/settlement.js';

function snapshot(runId = 'run-1'): RunStateSnapshot {
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

function reservation(overrides: Partial<RunReservation> = {}): RunReservation {
  return {
    reservationId: 'res:run-1:s1:1000',
    runId: 'run-1',
    stepId: 's1',
    actionDigest: 'digest-s1',
    stepAction: 'simulate',
    effects: { spends: [{ tokenId: '0x00', amount: '1000' }], fees: [], channels: [] },
    reservedAt: 1000,
    expiresAt: 2000,
    status: 'reserved',
    mandateIds: ['totem:mandate:owner'],
    decisionIds: ['decision-1'],
    usageDeltas: [{ mandateId: 'totem:mandate:owner', delta: { count: 1, amount: '1000' } }],
    ...overrides,
  };
}

function instruction(
  overrides: Partial<Omit<SettlementInstructionV1, 'settlementId'>> & { settlementId?: string } = {},
): SettlementInstructionV1 {
  const body = {
    schema: 'totem:act:settlement/v1' as const,
    reservationId: 'res:run-1:s1:1000',
    operationId: 'op-1',
    preparedCommandDigest: 'prepared-1',
    dispatchState: 'dispatched' as const,
    terminalOutcome: 'failed' as const,
    disposition: 'settle-actual' as const,
    actual: {
      schema: 'totem:act:actual-consumption/v1' as const,
      spends: [{ tokenId: '0x00', amount: '400' }],
      fees: [],
      mandateUsage: [{ mandateId: 'totem:mandate:owner', count: 1, amount: '400' }],
      evidenceRefs: ['meter:1'],
      measuredAt: 1500,
      measurementStatus: 'verified' as const,
    },
    evidenceRefs: ['meter:1'],
    ...overrides,
  };
  return { ...body, settlementId: overrides.settlementId ?? computeSettlementId(body) };
}

function sqliteAvailable(): boolean {
  try {
    const store = new SqliteRunStateStore(':memory:');
    store.close();
    return true;
  } catch {
    return false;
  }
}

async function runSettlementSuite(makeStore: () => RunStateStore): Promise<void> {
  const store = makeStore();
  await store.createRun(snapshot());
  await store.reserveStep(reservation());

  const receipt = await store.settleReservation(instruction());

  const run = await store.getRun('run-1');
  expect(run?.totals.committedSteps).toBe(1);
  expect(run?.totals.reservedSteps).toBe(0);
  expect(run?.totals.abortedSteps).toBe(0);
  expect(run?.totals.spentByToken['0x00']).toBe('400');

  const usage = await store.getMandateUsage('res:run-1:s1:1000');
  expect(usage).toEqual([{ mandateId: 'totem:mandate:owner', count: 1, amount: '400', status: 'committed' }]);

  expect(receipt.terminalOutcome).toBe('failed');
  expect(receipt.dispatchState).toBe('dispatched');
  expect(receipt.reservedUsage).toEqual({ count: 1, amount: '1000' });
  expect(receipt.releasedUsage).toEqual({ count: 0, amount: '600' });
  expect(receipt.actualConsumption?.spends).toEqual([{ tokenId: '0x00', amount: '400' }]);
  expect(receipt.settlementId).toBeDefined();

  // Idempotent replay returns the persisted receipt.
  await expect(store.settleReservation(instruction())).resolves.toEqual(receipt);

  // Conflicting settlement of an already-closed reservation fails closed.
  await expect(
    store.settleReservation(instruction({ settlementId: 'different' })),
  ).rejects.toThrow(/already settled/);
}

describe('RFC-022 Amendment A settlement', () => {
  it('settles actual partial usage in the in-memory authority', async () => {
    await runSettlementSuite(() => new MemoryRunStateStore({ now: () => 1000 }));
  });

  it('settles actual partial usage in the SQLite authority', async () => {
    if (!sqliteAvailable()) return;
    await runSettlementSuite(() => new SqliteRunStateStore(':memory:', { now: () => 1000 }));
  });

  it('releases a proven non-dispatched reservation and records an abort', async () => {
    const store = new MemoryRunStateStore({ now: () => 1000 });
    await store.createRun(snapshot());
    await store.reserveStep(reservation());

    const receipt = await store.settleReservation(instruction({
      dispatchState: 'not-dispatched',
      terminalOutcome: 'cancelled',
      disposition: 'release-nonexecution',
      actual: undefined,
    }));

    const run = await store.getRun('run-1');
    expect(run?.totals.abortedSteps).toBe(1);
    expect(run?.totals.committedSteps).toBe(0);
    expect(run?.totals.spentByToken['0x00']).toBeUndefined();
    expect((await store.getMandateUsage('res:run-1:s1:1000'))[0].status).toBe('aborted');
    expect(receipt.releasedUsage).toEqual({ count: 1, amount: '1000' });
  });

  it('commits the full reserved amount when no meter is available', async () => {
    const store = new MemoryRunStateStore({ now: () => 1000 });
    await store.createRun(snapshot());
    await store.reserveStep(reservation());

    await store.settleReservation(instruction({
      terminalOutcome: 'failed',
      disposition: 'commit-reserved',
      actual: undefined,
    }));

    const run = await store.getRun('run-1');
    expect(run?.totals.spentByToken['0x00']).toBe('1000');
    expect((await store.getMandateUsage('res:run-1:s1:1000'))[0].amount).toBe('1000');
  });

  it('rejects actual usage above the reserved maximum', async () => {
    const store = new MemoryRunStateStore({ now: () => 1000 });
    await store.createRun(snapshot());
    await store.reserveStep(reservation());

    await expect(store.settleReservation(instruction({
      actual: {
        schema: 'totem:act:actual-consumption/v1',
        spends: [{ tokenId: '0x00', amount: '1001' }],
        fees: [],
        mandateUsage: [{ mandateId: 'totem:mandate:owner', count: 1, amount: '1001' }],
        evidenceRefs: ['meter:1'],
        measuredAt: 1500,
        measurementStatus: 'verified',
      },
    }))).rejects.toThrow(/exceeds reserved/);
  });

  it('settles an expired reservation only through the recovery path', async () => {
    let now = 1000;
    const store = new MemoryRunStateStore({ now: () => now });
    await store.createRun(snapshot());
    await store.reserveStep(reservation());
    now = 2500;

    // A normal commit after expiry is rejected and leaves the reservation HELD.
    const receipt = await store.settleReservation(instruction());
    expect(receipt.terminalOutcome).toBe('failed');
    expect((await store.getRun('run-1'))?.totals.spentByToken['0x00']).toBe('400');
  });

  it('renews a live lease but refuses to renew an expired one', async () => {
    let now = 1000;
    const store = new MemoryRunStateStore({ now: () => now });
    await store.createRun(snapshot());
    await store.reserveStep(reservation());

    await store.renewReservation('res:run-1:s1:1000', 3000, now);
    expect((await store.getReservation('res:run-1:s1:1000'))?.expiresAt).toBe(3000);

    now = 3001;
    await expect(store.renewReservation('res:run-1:s1:1000', 5000, now)).rejects.toThrow(/expired/);
  });

  it('charges actual usage against the grant budget, not the reservation', async () => {
    const store = new MemoryGrantUsageStore({ now: () => 1000 });
    const first = await store.authorizeAndReserve({
      runId: 'run-1',
      stepId: 's1',
      mandateId: 'mandate-1',
      actionDigest: 'digest-1',
      usageDelta: { count: 1, amount: '1000' },
      now: 1000,
      usageLimit: { maxCount: 10, maxTotal: '1000' },
    });

    await store.settleActual(instruction({
      reservationId: first.reservationId,
      terminalOutcome: 'failed',
      actual: {
        schema: 'totem:act:actual-consumption/v1',
        spends: [],
        fees: [],
        mandateUsage: [{ mandateId: 'mandate-1', count: 1, amount: '400' }],
        evidenceRefs: ['meter:1'],
        measuredAt: 1500,
        measurementStatus: 'verified',
      },
    }));

    await expect(store.authorizeAndReserve({
      runId: 'run-1',
      stepId: 's2',
      mandateId: 'mandate-1',
      actionDigest: 'digest-2',
      usageDelta: { count: 1, amount: '600' },
      now: 2000,
      usageLimit: { maxCount: 10, maxTotal: '1000' },
    })).resolves.toBeDefined();

    await expect(store.authorizeAndReserve({
      runId: 'run-1',
      stepId: 's3',
      mandateId: 'mandate-1',
      actionDigest: 'digest-3',
      usageDelta: { count: 1, amount: '601' },
      now: 2000,
      usageLimit: { maxCount: 10, maxTotal: '1000' },
    })).rejects.toThrow(/exceeds|limit/);
  });
});
