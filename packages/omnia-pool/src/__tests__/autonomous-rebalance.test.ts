/**
 * omnia-pool/__tests__/autonomous-rebalance.test.ts — Autonomous rebalance
 * vertical slice: prepare → reduce → authorize → execute → commit/abort.
 */

import {
  createEmptyLiquidityBondRegistryState,
  type LiquidityBondRegistryState,
} from '@totemsdk/liquidity-bond';
import {
  createOmniaPool,
  depositToPool,
  allocatePositionCapital,
  executeAutonomousRebalanceStep,
  prepareRebalanceStep,
  type CreateOmniaPoolParams,
  type OmniaExecutionPort,
} from '../index.js';
import {
  GrantBoundAutonomyPolicy,
  MemoryRunStateStore,
  type AutonomyProfile,
} from '@totemsdk/agent-policy';
import { buildUpdateTx, type OmniaChannel, type OmniaTxDraft } from '@totemsdk/omnia';
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
const SEED_ROOT = testSeed(300);
const SEED_CTRL = testSeed(301);
const SEED_AGENT = testSeed(303);
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

function makeChannel(): OmniaChannel {
  return {
    channelId: 'ch-rebalance-1',
    fundingTxId: '0xtxpow0',
    fundingCoinId: '0x' + 'aa'.repeat(32),
    fundingScript: 'RETURN TRUE',
    programId: 'eltoo-payment',
    programVersion: 1,
    fundingAddress: '0x' + 'bb'.repeat(32),
    tokenId: '0x00',
    tokenScale: 0,
    totalValue: 1000n,
    parties: [
      { partyId: 'alice', publicKeyDigest: 'alice-pkd', addressIndex: 0 },
      { partyId: 'bob', publicKeyDigest: 'bob-pkd', addressIndex: 1 },
    ],
    balances: { alice: 600n, bob: 400n },
    pendingHTLCs: [],
    currentSequence: 0,
    latestState: null,
    stateLog: [],
    status: 'active',
    channelType: 'direct',
    createdAt: 0,
    updatedAt: 0,
  };
}

/** A draft that pays value OUT of the channel (external spend) — e.g. a settlement. */
function makeExternalSpendDraft(channel: OmniaChannel, amount: string, recipient: string): OmniaTxDraft {
  return {
    type: 'settlement',
    inputs: [{ coinId: channel.fundingCoinId, address: channel.fundingAddress, amount: channel.totalValue, tokenId: channel.tokenId, scriptHex: channel.fundingScript }],
    outputs: [{ address: recipient, amount: BigInt(amount), tokenId: channel.tokenId, storeState: false, stateVariables: [] }],
    storeState: false,
    stateVariables: [],
  };
}

// ── suite ───────────────────────────────────────────────────────────────────

describe('autonomous rebalance slice', () => {
  const tokenId = '0x00';
  const operator = 'MxOPERATOR';
  const lp = 'MxLP';
  let registry: LiquidityBondRegistryState;

  const passFundingVerifier = {
    verifyDeposit: jest.fn(async () => ({ valid: true })),
  };

  let fundingCoinSeq = 0;

  beforeEach(() => {
    registry = createEmptyLiquidityBondRegistryState();
  });

  function basePoolParams(): CreateOmniaPoolParams {
    return {
      poolId: 'pool-1',
      operatorAddress: operator,
      tokenId,
      purpose: 'omnia-channel-capital',
      poolType: 'community-pool',
      capacity: '1000000',
      feePolicy: { feeModel: 'pro-rata', lpFeeBps: 50, operatorFeeBps: 10 },
    };
  }

  async function makeDeposit(amount: string, purpose: 'community-liquidity' | 'omnia-channel-capital' = 'community-liquidity') {
    const { manifest, registry: reg } = createOmniaPool(basePoolParams(), registry);
    fundingCoinSeq++;
    const { position, state } = await depositToPool(
      { pool: manifest, lpAddress: lp, amount, purpose, underlyingUtxoRef: `0xFUND${fundingCoinSeq}`, chainProvider: passFundingVerifier },
      reg,
    );
    return { manifest, position, state };
  }

  async function makePolicy() {
    const { resolver, identityId } = await makeResolver();
    const mandate = makeMandateProof(identityId, '*');
    const policy = new GrantBoundAutonomyPolicy({
      autonomyProfiles: { 'channel-rebalance': PROFILE },
      mandateResolver: async (id) => (id === 'totem:mandate:owner' ? mandate : undefined),
      identityResolver: resolver,
      stateStore: new MemoryRunStateStore({ now: () => 1000 }),
      now: () => 1000,
    });
    return policy;
  }

  function makePort(overrides: Partial<OmniaExecutionPort> = {}): OmniaExecutionPort {
    return {
      createChannel: jest.fn(),
      updateState: jest.fn().mockResolvedValue({ sequence: 1, balances: { alice: 700n, bob: 300n } }),
      addHTLC: jest.fn(),
      fulfillHTLC: jest.fn(),
      proposeSettlement: jest.fn(),
      verifyStateForCoSign: jest.fn().mockResolvedValue({ valid: true, errors: [] }),
      closeChannel: jest.fn(),
      ...overrides,
    };
  }

  it('reduces a wallet-built update tx to canonical effects (channel-internal, no external spend)', () => {
    const channel = makeChannel();
    const draft = buildUpdateTx(channel, 1, { alice: 700n, bob: 300n }, []);
    const step = {
      stepId: 'sim-1',
      action: 'simulate',
      nonce: 'sim-1',
      draft,
      channelUpdate: { channel, newBalances: { alice: 700n, bob: 300n }, operation: 'simulate' },
      simulation: { ok: true },
    };
    const { canonical } = prepareRebalanceStep('run-1', 'PRINCIPAL', 'ag', step);
    expect(canonical.action).toBe('simulate');
    // Channel-internal update pays back to the channel script → no external spend.
    expect(canonical.effects.spends).toHaveLength(0);
    expect(canonical.effects.channels?.[0].channelId).toBe('ch-rebalance-1');
    expect(canonical.effects.channels?.[0].operation).toBe('simulate');
  });

  it('reduces an external spend draft to a canonical spend', () => {
    const channel = makeChannel();
    const draft = makeExternalSpendDraft(channel, '400', '0x' + 'cc'.repeat(32));
    const step = {
      stepId: 'pay-1',
      action: 'pay',
      nonce: 'pay-1',
      draft,
      simulation: { ok: true },
    };
    const { canonical } = prepareRebalanceStep('run-1', 'PRINCIPAL', 'ag', step);
    expect(canonical.effects.spends).toHaveLength(1);
    expect(canonical.effects.spends?.[0].amount).toBe('400');
    expect(canonical.effects.spends?.[0].recipient).toBe('0x' + 'cc'.repeat(32));
  });

  it('authorizes, executes and commits a channel update step', async () => {
    const policy = await makePolicy();
    await policy.openRun({ runId: 'run-1', agentId: 'ag', principal: 'PRINCIPAL', grantProofIds: ['totem:mandate:owner'], profileId: 'channel-rebalance' });

    const channel = makeChannel();
    const port = makePort();

    // simulate (valid from start)
    const simDraft = buildUpdateTx(channel, 1, { alice: 600n, bob: 400n }, []);
    const sim = await executeAutonomousRebalanceStep(
      { policy, runId: 'run-1', principal: 'PRINCIPAL', agentId: 'ag', ctx: { omnia: port } },
      {
        stepId: 'sim-1',
        action: 'simulate',
        nonce: 'sim-1',
        draft: simDraft,
        channelUpdate: { channel, newBalances: { alice: 600n, bob: 400n }, operation: 'simulate' },
        simulation: { ok: true },
      },
    );
    expect(sim.outcome).toBe('approved');

    // pay (valid from simulate)
    const payDraft = buildUpdateTx(channel, 2, { alice: 700n, bob: 300n }, []);
    const result = await executeAutonomousRebalanceStep(
      { policy, runId: 'run-1', principal: 'PRINCIPAL', agentId: 'ag', ctx: { omnia: port } },
      {
        stepId: 'pay-1',
        action: 'pay',
        nonce: 'pay-1',
        draft: payDraft,
        channelUpdate: { channel, newBalances: { alice: 700n, bob: 300n }, operation: 'state_update' },
        simulation: { ok: true },
      },
    );

    expect(result.outcome).toBe('approved');
    expect(result.txDigest).toBeTruthy();
    expect(port.updateState).toHaveBeenCalled();
    expect(result.channelUpdate?.channel.channelId).toBe('ch-rebalance-1');

    const graph = await policy.getRunReceiptGraph('run-1');
    expect(graph?.totals.committedSteps).toBe(2);
    expect(graph?.stepReceipts[1].executionProof).toMatchObject({ txDigest: result.txDigest });
  });

  it('aborts the reservation when execution fails', async () => {
    const policy = await makePolicy();
    await policy.openRun({ runId: 'run-2', agentId: 'ag', principal: 'PRINCIPAL', grantProofIds: ['totem:mandate:owner'], profileId: 'channel-rebalance' });

    const channel = makeChannel();
    const updateState = jest.fn()
      .mockResolvedValueOnce({ sequence: 1, balances: { alice: 600n, bob: 400n } })
      .mockRejectedValueOnce(new Error('balance conservation failed'));
    const port = makePort({ updateState });

    const simDraft = buildUpdateTx(channel, 1, { alice: 600n, bob: 400n }, []);
    const sim = await executeAutonomousRebalanceStep(
      { policy, runId: 'run-2', principal: 'PRINCIPAL', agentId: 'ag', ctx: { omnia: port } },
      {
        stepId: 'sim-1',
        action: 'simulate',
        nonce: 'sim-1',
        draft: simDraft,
        channelUpdate: { channel, newBalances: { alice: 600n, bob: 400n }, operation: 'simulate' },
        simulation: { ok: true },
      },
    );
    expect(sim.outcome).toBe('approved');

    const payDraft = buildUpdateTx(channel, 2, { alice: 700n, bob: 300n }, []);
    await expect(
      executeAutonomousRebalanceStep(
        { policy, runId: 'run-2', principal: 'PRINCIPAL', agentId: 'ag', ctx: { omnia: port } },
        {
          stepId: 'pay-1',
          action: 'pay',
          nonce: 'pay-1',
          draft: payDraft,
          channelUpdate: { channel, newBalances: { alice: 700n, bob: 300n }, operation: 'state_update' },
          simulation: { ok: true },
        },
      ),
    ).rejects.toThrow('balance conservation failed');

    const graph = await policy.getRunReceiptGraph('run-2');
    expect(graph?.totals.abortedSteps).toBe(1);
    expect(graph?.totals.committedSteps).toBe(1);
  });

  it('executes a pool allocation rebalance and commits', async () => {
    const policy = await makePolicy();
    await policy.openRun({ runId: 'run-3', agentId: 'ag', principal: 'PRINCIPAL', grantProofIds: ['totem:mandate:owner'], profileId: 'channel-rebalance' });

    const { position, state } = await makeDeposit('100000');
    const { allocation } = await allocatePositionCapital(
      {
        position,
        amount: '50000',
        allocationType: 'manual-reserve',
        purpose: 'community-liquidity',
        target: { type: 'reserve', purpose: 'old' },
      },
      state,
    );

    const channel = makeChannel();
    const simDraft = buildUpdateTx(channel, 1, { alice: 600n, bob: 400n }, []);
    const sim = await executeAutonomousRebalanceStep(
      { policy, runId: 'run-3', principal: 'PRINCIPAL', agentId: 'ag' },
      {
        stepId: 'sim-1',
        action: 'simulate',
        nonce: 'sim-1',
        draft: simDraft,
        channelUpdate: { channel, newBalances: { alice: 600n, bob: 400n }, operation: 'simulate' },
        simulation: { ok: true },
      },
    );
    expect(sim.outcome).toBe('approved');

    const result = await executeAutonomousRebalanceStep(
      { policy, runId: 'run-3', principal: 'PRINCIPAL', agentId: 'ag' },
      {
        stepId: 'rebalance-1',
        action: 'pay',
        nonce: 'rebalance-1',
        allocation: {
          params: { from: allocation, toTarget: { type: 'reserve', purpose: 'new' }, amount: '30000' },
          position,
          registry: state,
        },
        simulation: { ok: true },
      },
    );

    expect(result.outcome).toBe('approved');
    expect(result.allocation?.released.status).toBe('released');
    expect(result.allocation?.newAllocation.amount).toBe(30000n);

    const graph = await policy.getRunReceiptGraph('run-3');
    expect(graph?.totals.committedSteps).toBe(2);
  });

  it('returns requires_human when the step exceeds the run ceiling', async () => {
    const policy = await makePolicy();
    await policy.openRun({ runId: 'run-4', agentId: 'ag', principal: 'PRINCIPAL', grantProofIds: ['totem:mandate:owner'], profileId: 'channel-rebalance' });

    const channel = makeChannel();
    const simDraft = buildUpdateTx(channel, 1, { alice: 600n, bob: 400n }, []);
    const sim = await executeAutonomousRebalanceStep(
      { policy, runId: 'run-4', principal: 'PRINCIPAL', agentId: 'ag' },
      {
        stepId: 'sim-1',
        action: 'simulate',
        nonce: 'sim-1',
        draft: simDraft,
        channelUpdate: { channel, newBalances: { alice: 600n, bob: 400n }, operation: 'simulate' },
        simulation: { ok: true },
      },
    );
    expect(sim.outcome).toBe('approved');

    // A 'pay' step with an external spend of 600 exceeds maxGrossSpend (500).
    const bigDraft = makeExternalSpendDraft(channel, '600', '0x' + 'cc'.repeat(32));
    const result = await executeAutonomousRebalanceStep(
      { policy, runId: 'run-4', principal: 'PRINCIPAL', agentId: 'ag' },
      {
        stepId: 'pay-1',
        action: 'pay',
        nonce: 'pay-1',
        draft: bigDraft,
        simulation: { ok: true },
      },
    );

    expect(result.outcome).toBe('requires_human');
    expect(result.rejection?.suggestedGrant?.bindToRunId).toBe('run-4');
  });
});
