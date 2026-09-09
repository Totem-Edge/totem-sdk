import { GrantBoundAutonomyPolicy } from '../grant-bound-autonomy.js';
import { MemoryRunStateStore } from '../run-state-store.js';
import { createAutonomyPolicy, checkRunLimits, checkTransition, checkObligations, evaluateGrantRequirement } from '../autonomy.js';
import { reduceToCanonicalAction, summarizeStepSpend } from '../omnia-rebalance-slice.js';
import { canonicalAgentActionDigest } from '../run.js';
import type { AutonomyProfile, CanonicalAgentAction, GrantRequirement } from '../run.js';
import type { AuthorityIdentityResolver } from '@totemsdk/authority';
import type { SignedProof } from '@totemsdk/proof';
import { createAgentMandate } from '@totemsdk/authority';
import { createProof, signProof } from '@totemsdk/proof';
import { createIdentityDocument, createDelegationClaim, signIdentityClaim } from '@totemsdk/identity';
import { wotsKeypairFromSeed, scriptFromWotsPk, scriptToAddress } from '@totemsdk/core';

// ── fixtures ────────────────────────────────────────────────────────────────

function testSeed(n: number): Uint8Array {
  const s = new Uint8Array(32);
  s[0] = n & 0xff;
  return s;
}
function deriveAddress(seed: Uint8Array, keyIndex: number): string {
  const kp = wotsKeypairFromSeed(seed, keyIndex);
  return scriptToAddress(scriptFromWotsPk(kp.pk));
}
const SEED_ROOT = testSeed(100);
const SEED_CTRL = testSeed(101);
const SEED_AGENT = testSeed(103);
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

const PROFILE: AutonomyProfile = {
  profileId: 'channel-rebalance',
  mode: 'dynamic',
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
  boundaryFailure: 'request_narrow_grant',
};

async function makePolicy(_allowed: string[] = []) {
  const { resolver, identityId } = await makeResolver();
  const mandate = makeMandateProof(identityId, '*');
  let policy: GrantBoundAutonomyPolicy;
  policy = new GrantBoundAutonomyPolicy({
    autonomyProfiles: { 'channel-rebalance': PROFILE },
    mandateResolver: async (id) => (id === 'totem:mandate:owner' || id === 'totem:mandate:op' ? mandate : undefined),
    identityResolver: resolver,
    stateStore: new MemoryRunStateStore({ now: () => 1000 }),
    now: () => 1000,
  });
  return { policy, identityId };
}

function step(action: string, stepId = `${action}-1`, nonce = stepId, overrides: Partial<CanonicalAgentAction> = {}): CanonicalAgentAction {
  return {
    action,
    principal: 'PRINCIPAL',
    agent: 'ag',
    effects: {
      spends: action === 'pay' ? [{ tokenId: '0x00', amount: '100' }] : [],
      fees: [],
      channels: [{ channelId: 'ch-7', operation: action === 'pay' ? 'state_update' : action }],
      stateChanges: { positionId: 'pos-1' },
    },
    runId: 'run-1',
    stepId,
    nonce,
    ...overrides,
  };
}

// ── unit: autonomy helpers ──────────────────────────────────────────────────

describe('checkRunLimits', () => {
  it('rejects maxSteps', () => {
    const r = checkRunLimits(PROFILE, step('pay'), {
      committedSteps: 5, reservedSteps: 0, abortedSteps: 0,
      spentByToken: {}, feesByToken: {}, stepSpendByToken: {}, outstandingByToken: {},
      now: 2000, startedAt: 0,
    });
    expect(r?.boundary).toBe('run.maxSteps');
  });

  it('rejects maxParallel', () => {
    const r = checkRunLimits(PROFILE, step('pay'), {
      committedSteps: 0, reservedSteps: 1, abortedSteps: 0,
      spentByToken: {}, feesByToken: {}, stepSpendByToken: {}, outstandingByToken: {},
      now: 2000, startedAt: 0,
    });
    expect(r?.boundary).toBe('run.maxParallel');
  });

  it('escalates maxGrossSpend with a suggested narrow grant', () => {
    const r = checkRunLimits(PROFILE, step('pay', 'p1', 'n1', {
      effects: { spends: [{ tokenId: '0x00', amount: '40' }], channels: [{ channelId: 'ch-7', operation: 'pay' }] },
    }), {
      committedSteps: 0, reservedSteps: 0, abortedSteps: 0,
      spentByToken: { '0x00': '480' }, feesByToken: {},
      stepSpendByToken: { '0x00': '40' }, outstandingByToken: {},
      now: 2000, startedAt: 0,
    });
    expect(r?.kind).toBe('escalate');
    expect(r?.escalation?.remaining).toBe('20');
    expect(r?.escalation?.suggestedGrant?.bindToRunId).toBe('run-1');
  });
});

describe('checkTransition', () => {
  it('enforces the profile DAG', () => {
    expect(checkTransition(PROFILE, undefined, 'simulate')).toBe(true);
    expect(checkTransition(PROFILE, 'simulate', 'pay')).toBe(true);
    expect(checkTransition(PROFILE, 'pay', 'verify')).toBe(true);
    expect(checkTransition(PROFILE, 'simulate', 'verify')).toBe(false);
    expect(checkTransition(PROFILE, 'verify', 'compensate')).toBe(false);
  });
});

describe('checkObligations', () => {
  it('requires simulation when the profile asks for it', () => {
    const r = checkObligations(PROFILE.obligations, step('pay'), {}, 1000);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('simulation required');
  });
});

describe('evaluateGrantRequirement', () => {
  it('enforces explicit allOf/anyOf semantics', () => {
    const req: GrantRequirement = { allOf: ['a', 'b'] };
    expect(evaluateGrantRequirement(req, ['a', 'b'])).toBe(true);
    expect(evaluateGrantRequirement(req, ['a'])).toBe(false);

    const any: GrantRequirement = { anyOf: ['x', 'y'] };
    expect(evaluateGrantRequirement(any, ['x'])).toBe(true);
    expect(evaluateGrantRequirement(any, ['z'])).toBe(false);
  });
});

// ── integration: autonomous run + atomic authorize/commit/abort ────────────

describe('GrantBoundAutonomyPolicy — rebalance run', () => {
  it('authorizes prepared steps, folds spend into run totals, and produces a receipt graph', async () => {
    const { policy } = await makePolicy();
    const run = await policy.openRun({ runId: 'run-1', agentId: 'ag', principal: 'PRINCIPAL', grantProofIds: ['totem:mandate:owner'], profileId: 'channel-rebalance' });
    expect(run.totals.committedSteps).toBe(0);

    // prepare + reduce the first operation
    const prepared = {
      stepId: 'sim-1',
      action: 'simulate',
      nonce: 'sim-1',
      operation: { spends: [], fees: [], channelOps: [{ channelId: 'ch-7', operation: 'simulate' }] },
    };
    const canonical = reduceToCanonicalAction('run-1', 'PRINCIPAL', 'ag', prepared as never, { simulation: { ok: true } });
    const auth = await policy.authorizeAndReserve({ runId: 'run-1', stepId: 'sim-1', nonce: 'sim-1', action: canonical, evidence: { simulation: { ok: true } } });
    expect(auth.outcome).toBe('approved');
    await policy.commit({ reservationId: (auth as { reservationId: string }).reservationId, executionProof: { sim: 'ok' } });

    // pay step with spend — folds into run totals
    const payAuth = await policy.authorizeAndReserve({
      runId: 'run-1', stepId: 'pay-1', nonce: 'pay-1',
      action: step('pay', 'pay-1', 'pay-1'),
      evidence: { simulation: { ok: true }, executionReceipt: { tx: '0x1' } },
    });
    expect(payAuth.outcome).toBe('approved');
    await policy.commit({ reservationId: (payAuth as { reservationId: string }).reservationId, executionProof: { tx: '0x1' } });

    const graph = await policy.getRunReceiptGraph('run-1');
    expect(graph?.totals.committedSteps).toBe(2);
    expect(graph?.totals.spentByToken['0x00']).toBe('100');
    expect(graph?.stepReceipts).toHaveLength(2);
  });

  it('enforces the profile transition DAG and rejects out-of-order steps', async () => {
    const { policy } = await makePolicy();
    await policy.openRun({ runId: 'run-b', agentId: 'ag', principal: 'PRINCIPAL', grantProofIds: ['totem:mandate:owner'], profileId: 'channel-rebalance' });
    const auth = await policy.authorizeAndReserve({
      runId: 'run-b', stepId: 'pay-1', nonce: 'pay-1', action: step('pay'),
    });
    expect(auth.outcome).toBe('rejected');
    expect((auth as { reason: string }).reason).toContain('is not a valid transition');
  });

  it('rejects a replayed nonce', async () => {
    const { policy } = await makePolicy();
    await policy.openRun({ runId: 'run-c', agentId: 'ag', principal: 'PRINCIPAL', grantProofIds: ['totem:mandate:owner'], profileId: 'channel-rebalance' });
    const a = await policy.authorizeAndReserve({ runId: 'run-c', stepId: 's1', nonce: 'same', action: step('simulate'), evidence: { simulation: { ok: true } } });
    expect(a.outcome).toBe('approved');
    await policy.abort((a as { reservationId: string }).reservationId, 'n/a');
    const b = await policy.authorizeAndReserve({ runId: 'run-c', stepId: 's2', nonce: 'same', action: step('simulate'), evidence: { simulation: { ok: true } } });
    expect(b.outcome).toBe('rejected');
    expect((b as { reason: string }).reason).toContain('already used');
  });

  it('escalates to requires_human with a narrow-grant suggestion when spend exceeds the ceiling', async () => {
    const { policy } = await makePolicy();
    await policy.openRun({ runId: 'run-d', agentId: 'ag', principal: 'PRINCIPAL', grantProofIds: ['totem:mandate:owner'], profileId: 'channel-rebalance' });

    // simulate must be the first step per the profile DAG — commit it so its slot frees
    const sim = await policy.authorizeAndReserve({ runId: 'run-d', stepId: 'sim-1', nonce: 'sim-1', action: step('simulate'), evidence: { simulation: { ok: true } } });
    expect(sim.outcome).toBe('approved');
    await policy.commit({ reservationId: (sim as { reservationId: string }).reservationId, executionProof: { sim: 'ok' } });

    const big = step('pay', 'pay-1', 'pay-1', {
      effects: { spends: [{ tokenId: '0x00', amount: '480' }], channels: [{ channelId: 'ch-7', operation: 'pay' }] },
    });
    const a = await policy.authorizeAndReserve({ runId: 'run-d', stepId: 'pay-1', nonce: 'pay-1', action: big, evidence: { simulation: { ok: true } } });
    expect(a.outcome).toBe('approved');
    await policy.commit({ reservationId: (a as { reservationId: string }).reservationId, executionProof: { tx: '0x1' } });

    const r = await policy.authorizeAndReserve({
      runId: 'run-d', stepId: 'pay-2', nonce: 'pay-2',
      action: step('pay', 'pay-2', 'pay-2'),
      evidence: { simulation: { ok: true } },
    });
    expect(r.outcome).toBe('requires_human');
    const rejected = r as { suggestedGrant?: { bindToRunId: string } };
    expect(rejected.suggestedGrant?.bindToRunId).toBe('run-d');
  });

  it('aborts failed steps and enforces the failure budget', async () => {
    const { policy } = await makePolicy();
    await policy.openRun({ runId: 'run-e', agentId: 'ag', principal: 'PRINCIPAL', grantProofIds: ['totem:mandate:owner'], profileId: 'channel-rebalance' });
    // maxFailures: 2 → exactly 2 aborts are permitted
    for (const [sid, nonce] of [['s1', 'n1'], ['s2', 'n2']]) {
      const a = await policy.authorizeAndReserve({ runId: 'run-e', stepId: sid, nonce, action: step('simulate', sid, nonce), evidence: { simulation: { ok: true } } });
      expect(a.outcome).toBe('approved');
      await policy.abort((a as { reservationId: string }).reservationId, 'boom');
    }
    const graph = await policy.getRunReceiptGraph('run-e');
    expect(graph?.totals.abortedSteps).toBe(2);
    // 3rd attempt over the failure budget (maxFailures: 2)
    const over = await policy.authorizeAndReserve({ runId: 'run-e', stepId: 's3', nonce: 'n3', action: step('simulate', 's3', 'n3'), evidence: { simulation: { ok: true } } });
    expect(over.outcome).toBe('rejected');
    expect((over as { reason: string }).reason).toContain('maxFailures');
  });
});

// ── slice: reduce prepared operation → canonical action ────────────────────

describe('omnia rebalance slice', () => {
  it('reduces a prepared operation to canonical effects and a stable digest', () => {
    const prepared = {
      stepId: 'pay-1', action: 'pay', nonce: 'pay-1',
      operation: {
        spends: [{ tokenId: '0x00', amount: '100', recipient: 'MxR' }],
        fees: [{ tokenId: '0x00', amount: '1' }],
        channelOps: [{ channelId: 'ch-7', operation: 'state_update' }],
        positionId: 'pos-1',
      },
    };
const canonical = reduceToCanonicalAction('run-1', 'PRINCIPAL', 'ag', prepared as never, { simulation: { ok: true } });
    expect(canonical.effects.spends?.[0].amount).toBe('100');
    expect(canonical.effects.channels?.[0].channelId).toBe('ch-7');
    const d1 = canonicalAgentActionDigest(canonical);
    const d2 = canonicalAgentActionDigest(canonical);
    expect(d1).toBe(d2);
    const tampered = { ...canonical, effects: { ...canonical.effects, spends: [{ tokenId: '0x00', amount: '999', recipient: 'MxR' }] } };
    expect(canonicalAgentActionDigest(tampered)).not.toBe(d1);
  });

  it('summarizes committed spend', () => {
    expect(summarizeStepSpend({ spends: [{ tokenId: '0x00', amount: '40' }] })['0x00']).toBe('40');
  });
});
