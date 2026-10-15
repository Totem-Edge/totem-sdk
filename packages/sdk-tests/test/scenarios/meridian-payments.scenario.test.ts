/**
 * Scenario: "Meridian Pay" — LP capital → VTXO payment pool → end-user spend →
 * LP withdrawal. Cross-package end-to-end across the three pool-adjacent layers:
 *
 *   - `@totemsdk/liquidity-bond` — the position/receipt/allocation/fee ledger (data only)
 *   - `@totemsdk/omnia-pool`     — the LP capital pool (deploy → deposit → allocate → fees → withdraw)
 *   - `@totemsdk/omnia-vtxo`     — the spendable VTXO balances + per-share exit
 *
 * The on-chain chain-provider legs (funding confirmation, PoW broadcast, MMR
 * proofs) are mocked (this is a unit-level integration scenario); everything the
 * three packages *compute* — manifests, positions, receipts, VTXOs, proofs,
 * receipts, allocations, NAV, exit drafts — is the real code.
 */

import { createEmptyLiquidityBondRegistryState } from '@totemsdk/liquidity-bond';
import {
  createOmniaPool,
  depositToPool,
  allocatePositionCapital,
  recordPoolFee,
  computePoolNAV,
  withdrawLiquidity,
  approveWithdrawal,
  executePoolPayout,
  type VtxoExecutionPort,
} from '@totemsdk/omnia-pool';
import {
  createPool,
  mintVtxo,
  transferVtxo,
  createExitDraft,
  markExiting,
  markExited,
  type OmniaVtxo,
  type OmniaVtxoPool,
} from '@totemsdk/omnia-vtxo';

const NOW = 1_700_000_000_000;
const TOKEN = '0x00';
const MERIDIAN = 'MxMERIDIAN';   // pool operator
const ACME = 'MxACME';          // liquidity provider
const SHOPPER = 'MxSHOPPER';    // end user
const MERCHANT = 'MxMERCHANT';  // merchant

// Funding-truth verifier (stands in for the live chain-provider).
const passFundingVerifier = { verifyDeposit: async () => ({ valid: true }) };

// Live VTXO port — delegates to the real omnia-vtxo functions.
const vtxoPort: VtxoExecutionPort = {
  async createPool(p) {
    return createPool(
      { operator: p.operator, tokenId: p.tokenId, totalCapacity: BigInt(p.totalCapacity), nonce: p.nonce },
      NOW,
    );
  },
  async mintVtxo(pool, params) {
    return mintVtxo(pool, params, NOW);
  },
  async createExitDraft(vtxo) {
    return createExitDraft(vtxo, NOW).draft;
  },
  async markExiting(vtxo, now) {
    return markExiting(vtxo, now ?? NOW);
  },
  async markExited(vtxo, txpowId, now) {
    return markExited(vtxo, { txpowId, now: now ?? NOW });
  },
};

describe('scenario: Meridian Pay (liquidity-bond + omnia-pool + omnia-vtxo)', () => {
  it('runs LP funding → VTXO pool → spend → fee → withdrawal', async () => {
    let registry = createEmptyLiquidityBondRegistryState();

    // ── 0. Meridian deploys the pool (omnia-pool → liquidity-bond manifest)
    const { manifest } = createOmniaPool(
      {
        poolId: 'meridian-minima-1',
        operatorAddress: MERIDIAN,
        tokenId: TOKEN,
        purpose: 'statechain-exit-reserve',
        poolType: 'community-pool',
        capacity: '1000000',
        feePolicy: { feeModel: 'pro-rata', lpFeeBps: 50, operatorFeeBps: 10 },
      },
      registry,
    );
    expect(manifest.poolId).toBe('meridian-minima-1');

    // ── 1. Acme commits liquidity → position + receipt (liquidity-bond)
    const dep = await depositToPool(
      {
        pool: manifest,
        lpAddress: ACME,
        amount: '100000',
        purpose: 'statechain-exit-reserve',
        underlyingUtxoRef: '0xFUND1',
        chainProvider: passFundingVerifier,
      },
      registry,
    );
    registry = dep.state;
    expect(dep.position.amount).toBe(100000n);
    expect(dep.receipt.ownerAddress).toBe(ACME);

    // ── 2. Meridian allocates Acme's capital into a VTXO payment pool (omnia-vtxo)
    const vtxoPool = createPool(
      { operator: MERIDIAN, tokenId: TOKEN, totalCapacity: 1_000_000n, nonce: 'meridian-vtxo-1' },
      NOW,
    );
    const alloc = await allocatePositionCapital(
      {
        position: dep.position,
        amount: '25000',
        allocationType: 'settlement-reserve',
        purpose: 'statechain-exit-reserve',
        target: { type: 'vtxo', pool: vtxoPool, params: { owner: SHOPPER, amount: 25000n, nonce: 'shop-1' } },
        ctx: { vtxo: vtxoPort },
      },
      registry,
    );
    registry = alloc.registry;
    const { vtxo } = alloc.execution as { pool: OmniaVtxoPool; vtxo: OmniaVtxo };
    expect(vtxo.owner).toBe(SHOPPER);
    expect(vtxo.amount).toBe(25000n);

    // ── 3. The shopper pays the merchant with the VTXO (omnia-vtxo, off-chain)
    const payment = transferVtxo(vtxo, { recipient: MERCHANT, amount: 5000n, nonce: 'pay-1' }, NOW);
    expect(payment.output.owner).toBe(MERCHANT);
    expect(payment.output.amount).toBe(5000n);
    expect(payment.change?.owner).toBe(SHOPPER);
    expect(payment.change?.amount).toBe(20000n);

    // ── 4. A routing fee accrues (omnia-pool → liquidity-bond), reflected in NAV
    const fee = recordPoolFee(
      {
        pool: manifest,
        position: dep.position,
        grossAmount: '20000',
        source: 'route-fee',
        earnProof: { paymentId: 'pay-1', htlcId: 'h-1' },
        verified: true,
      },
      registry,
    );
    registry = fee.registry;
    expect(fee.feeRecord.lpFeeAmount).toBe(100n); // 20000 * 50bps
    const nav = computePoolNAV(manifest, registry);
    expect(nav.accruedFees).toBe(100n);
    expect(nav.nav).toBe(nav.totalCommitted + 100n);

    // ── 5. Acme withdraws: intent → approval → per-share VTXO exit
    const { intent, state: withIntent } = withdrawLiquidity(
      manifest,
      dep.position,
      { positionId: dep.position.positionId, amount: '1000', recipientAddress: ACME },
      registry,
    );
    const approved = approveWithdrawal(intent, dep.position, withIntent);

    const posForExit = {
      ...dep.position,
      vtxoPoolId: vtxoPool.poolId,
      metadata: { ...(dep.position.metadata ?? {}), withdrawalVtxo: payment.change ?? vtxo },
    };
    const payout = await executePoolPayout(
      {
        pool: manifest,
        position: posForExit,
        intent: approved.intent,
        recipientAddress: ACME,
        ctx: { vtxo: vtxoPort },
      },
      approved.registry,
    );
    expect(payout.execution).toMatchObject({ draftType: 'vtxo-exit' });
    expect((payout.execution as { owner: string }).owner).toBe(SHOPPER);
  });
});
