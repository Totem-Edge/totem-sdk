import { SqliteRunStateStore } from '../sqlite-run-state-store.js';
import { GrantBoundAutonomyPolicy } from '../grant-bound-autonomy.js';
import { reduceToCanonicalAction } from '../omnia-rebalance-slice.js';
import type { RunReservation, RunStateSnapshot, RunStepReceipt } from '../run-state-store.js';
import type { StepReceipt } from '../run.js';
import type { AuthorityIdentityResolver } from '@totemsdk/authority';
import type { SignedProof } from '@totemsdk/proof';
import { createAgentMandate } from '@totemsdk/authority';
import { createProof, signProof } from '@totemsdk/proof';
import { createIdentityDocument, createDelegationClaim, signIdentityClaim } from '@totemsdk/identity';
import { wotsKeypairFromSeed, scriptFromWotsPk, scriptToAddress } from '@totemsdk/core';

function sqliteAvailable(): boolean {
  try {
    const store = new SqliteRunStateStore(':memory:');
    store.close();
    return true;
  } catch (error) {
    if (String(error).includes('Could not locate the bindings file')) return false;
    throw error;
  }
}

const describeSqlite = sqliteAvailable() ? describe : describe.skip;

function testSeed(n: number): Uint8Array {
  const s = new Uint8Array(32);
  s[0] = n & 0xff;
  return s;
}
function deriveAddress(seed: Uint8Array, keyIndex: number): string {
  const kp = wotsKeypairFromSeed(seed, keyIndex);
  return scriptToAddress(scriptFromWotsPk(kp.pk));
}
const SEED_ROOT = testSeed(200);
const SEED_CTRL = testSeed(201);
const SEED_AGENT = testSeed(203);
const ADDR_ROOT = deriveAddress(SEED_ROOT, 0);
const ADDR_AGENT = deriveAddress(SEED_AGENT, 0);

async function makeResolver() {
  const rootAddr = deriveAddress(SEED_ROOT, 0);
  const ctrlAddr = deriveAddress(SEED_CTRL, 0);
  const doc = createIdentityDocument({ kind: 'agent', rootAddress: rootAddr, controllerAddress: ctrlAddr });
  const claim = createDelegationClaim({ issuer: rootAddr, subject: doc.id, delegatedAddress: ADDR_AGENT, scopes: ['authority:grant'], issuedAt: 1000 });
  const signed = await signIdentityClaim(claim, SEED_ROOT, 0);
  const graph = { document: doc, claims: [signed] };
  return { resolver: { resolve: (id: string) => (id === doc.id ? graph : undefined) } as AuthorityIdentityResolver, identityId: doc.id };
}

function makeMandateProof(identityId: string, scope: string): SignedProof {
  const mandate = createAgentMandate({
    grantor: ADDR_ROOT,
    grantee: ADDR_AGENT,
    principal: identityId,
    scope,
    usageLimit: { maxCount: 100 },
    issuedAt: 0,
  });
  const unsigned = createProof({
    kind: 'custom',
    subject: { id: mandate.grantee, kind: 'agent' },
    issuer: mandate.grantor,
    issuedAt: mandate.issuedAt,
    expiresAt: mandate.expiresAt,
    payload: { schema: 'totem:authority:mandate/v1', mandate },
  });
  return signProof(unsigned, SEED_ROOT, 0);
}

const PROFILE = {
  profileId: 'channel-rebalance',
  mode: 'dynamic' as const,
  runLimits: {
    maxSteps: 5,
    maxParallel: 1,
    maxFailures: 2,
    maxDurationMs: 3_600_000,
    maxGrossSpend: { tokenId: '0x00', amount: '500' },
    maxFees: { tokenId: '0x00', amount: '10' },
  },
  transitions: [
    { from: 'start', to: ['simulate'] },
    { from: 'simulate', to: ['pay', 'requote'] },
    { from: 'pay', to: ['pay', 'verify', 'compensate'] },
  ],
  obligations: { requireSimulation: true },
  boundaryFailure: 'request_narrow_grant' as const,
};

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

function reservation(runId: string, stepId: string, reservedAt: number): RunReservation {
  return {
    reservationId: `res:${runId}:${stepId}:${reservedAt}`,
    runId,
    stepId,
    stepAction: 'simulate',
    actionDigest: `digest-${stepId}`,
    effects: { spends: [], fees: [], channels: [{ channelId: 'ch-7', operation: 'simulate' }] },
    reservedAt,
    expiresAt: reservedAt + 60_000,
    status: 'reserved',
    mandateIds: ['totem:mandate:owner'],
    decisionIds: ['d1'],
    usageDeltas: [{ mandateId: 'totem:mandate:owner', delta: { count: 1 } }],
  };
}

function receipt(reservationId: string, runId: string, stepId: string, committedAt: number): RunStepReceipt {
  return {
    reservationId,
    runId,
    stepId,
    actionDigest: `digest-${stepId}`,
    committedAt,
    mandateIds: ['totem:mandate:owner'],
    decisionIds: ['d1'],
    effects: { spends: [{ tokenId: '0x00', amount: '100' }], fees: [], channels: [{ channelId: 'ch-7', operation: 'pay' }] },
  };
}

describeSqlite('SqliteRunStateStore — RunStateStore', () => {
  it('persists runs, reservations, receipts and nonces', async () => {
    const store = new SqliteRunStateStore(':memory:', { now: () => 2000 });
    await store.createRun(snapshot('run-1'));
    await store.reserveStep(reservation('run-1', 's1', 1000));
    expect(await store.checkNonce('run-1', 'n1')).toBe(true);
    expect(await store.checkNonce('run-1', 'n1')).toBe(false);

    const res = await store.getReservation('res:run-1:s1:1000');
    expect(res?.status).toBe('reserved');

    await store.commitStep('res:run-1:s1:1000', receipt('res:run-1:s1:1000', 'run-1', 's1', 2000));
    const run = await store.getRun('run-1');
    expect(run?.totals.committedSteps).toBe(1);
    expect(run?.totals.spentByToken['0x00']).toBe('100');
    expect(await store.listStepReceipts('run-1')).toHaveLength(1);
    store.close();
  });

  it('aborts and enforces the failure budget', async () => {
    const store = new SqliteRunStateStore(':memory:', { now: () => 2000 });
    await store.createRun(snapshot('run-2'));
    await store.reserveStep(reservation('run-2', 's1', 1000));
    await store.abortStep('res:run-2:s1:1000', 'boom');
    const run = await store.getRun('run-2');
    expect(run?.totals.abortedSteps).toBe(1);
    expect(run?.totals.reservedSteps).toBe(0);
    store.close();
  });

  it('rejects commit of an expired reservation', async () => {
    const store = new SqliteRunStateStore(':memory:', { now: () => 200_000 });
    await store.createRun(snapshot('run-3'));
    await store.reserveStep(reservation('run-3', 's1', 1000));
    await expect(store.commitStep('res:run-3:s1:1000', receipt('res:run-3:s1:1000', 'run-3', 's1', 200_000)))
      .rejects.toThrow('has expired');
    store.close();
  });

  it('survives reopen on a file path', async () => {
    const dir = require('node:os').tmpdir();
    const path = `${dir}/totem-agent-policy-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
    const store = new SqliteRunStateStore(path, { now: () => 2000 });
    await store.createRun(snapshot('run-4'));
    await store.reserveStep(reservation('run-4', 's1', 1000));
    await store.commitStep('res:run-4:s1:1000', receipt('res:run-4:s1:1000', 'run-4', 's1', 2000));
    store.close();

    const reopened = new SqliteRunStateStore(path, { now: () => 2000 });
    const run = await reopened.getRun('run-4');
    expect(run?.totals.committedSteps).toBe(1);
    expect(await reopened.listStepReceipts('run-4')).toHaveLength(1);
    expect(await reopened.checkNonce('run-4', 'n1')).toBe(true);
    reopened.close();
    require('node:fs').unlinkSync(path);
  });
});

describeSqlite('SqliteRunStateStore — GrantUsageStore', () => {
  it('reserves, commits and lists mandate usage', async () => {
    const store = new SqliteRunStateStore(':memory:', { now: () => 2000 });
    const auth = await store.authorizeAndReserve({
      runId: 'run-1', stepId: 's1', mandateId: 'm1', actionDigest: 'd1',
      usageDelta: { count: 1, amount: '100' }, now: 1000,
    });
    expect(auth.reservationId).toContain('grant:');
    await store.commit(auth.reservationId, {
      reservationId: auth.reservationId, runId: 'run-1', stepId: 's1', mandateId: 'm1',
      actionDigest: 'd1', committedAt: 2000,
    } as StepReceipt);
    const receipts = await store.listCommittedReceipts('m1');
    expect(receipts).toHaveLength(1);
    expect(receipts[0].mandateId).toBe('m1');
    store.close();
  });

  it('aborts release the reservation', async () => {
    const store = new SqliteRunStateStore(':memory:', { now: () => 2000 });
    const auth = await store.authorizeAndReserve({
      runId: 'run-1', stepId: 's1', mandateId: 'm1', actionDigest: 'd1',
      usageDelta: { count: 1 }, now: 1000,
    });
    await store.abort(auth.reservationId, 'nope');
    expect(await store.listCommittedReceipts('m1')).toHaveLength(0);
    store.close();
  });
});

describeSqlite('GrantBoundAutonomyPolicy on SqliteRunStateStore', () => {
  it('runs a full rebalance run with atomic mandate usage', async () => {
    const { resolver, identityId } = await makeResolver();
    const mandate = makeMandateProof(identityId, '*');
    const store = new SqliteRunStateStore(':memory:', { now: () => 1000 });
    const policy = new GrantBoundAutonomyPolicy({
      autonomyProfiles: { 'channel-rebalance': PROFILE },
      mandateResolver: async (id) => (id === 'totem:mandate:owner' ? mandate : undefined),
      identityResolver: resolver,
      stateStore: store,
      now: () => 1000,
    });

    await policy.openRun({ runId: 'run-1', agentId: 'ag', principal: 'PRINCIPAL', grantProofIds: ['totem:mandate:owner'], profileId: 'channel-rebalance' });

    const prepared = {
      stepId: 'sim-1', action: 'simulate', nonce: 'sim-1',
      operation: { spends: [], fees: [], channelOps: [{ channelId: 'ch-7', operation: 'simulate' }] },
    };
    const canonical = reduceToCanonicalAction('run-1', 'PRINCIPAL', 'ag', prepared as never, { simulation: { ok: true } });
    const auth = await policy.authorizeAndReserve({ runId: 'run-1', stepId: 'sim-1', nonce: 'sim-1', action: canonical, evidence: { simulation: { ok: true } } });
    expect(auth.outcome).toBe('approved');
    await policy.commit({ reservationId: (auth as { reservationId: string }).reservationId, executionProof: { sim: 'ok' } });

    const graph = await policy.getRunReceiptGraph('run-1');
    expect(graph?.totals.committedSteps).toBe(1);
    expect(graph?.stepReceipts).toHaveLength(1);
    store.close();
  });
});
