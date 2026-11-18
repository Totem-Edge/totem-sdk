/**
 * OMN-004 — payout finality must be verified, never asserted by the caller.
 *
 * An `executePoolPayout` settlement is only allowed to advance accounting when
 * a verifier confirms it against a real evidence source and the evidence is
 * bound to the exact withdrawal, pool, position, recipient and amount.
 */

import {
  createEmptyLiquidityBondRegistryState,
  serializeLiquidityBondState,
} from '@totemsdk/liquidity-bond';
import {
  approveWithdrawal,
  createOmniaPool,
  depositToPool,
  executePoolPayout,
  withdrawLiquidity,
  type CreateOmniaPoolParams,
  type PayoutFinality,
  type PayoutSettlementVerifier,
} from '../index.js';

describe('omnia-pool payout finality (OMN-004)', () => {
  const tokenId = '0x00';
  const operator = 'MxOPERATOR';
  const lp = 'MxLP';
  let fundingSeq = 0;

  const passFundingVerifier = {
    verifyDeposit: jest.fn(async () => ({ valid: true })),
  };

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

  async function approvedWithdrawal(amount = '100000', withdrawAmount = '1000') {
    const empty = createEmptyLiquidityBondRegistryState();
    const { manifest, registry: poolReg } = createOmniaPool(basePoolParams(), empty);
    fundingSeq++;
    const { position, state } = await depositToPool(
      {
        pool: manifest,
        lpAddress: lp,
        amount,
        purpose: 'omnia-channel-capital',
        underlyingUtxoRef: `0xFUND${fundingSeq}`,
        chainProvider: passFundingVerifier,
      },
      poolReg,
    );
    const { intent, state: withIntent } = withdrawLiquidity(
      manifest,
      position,
      { positionId: position.positionId, amount: withdrawAmount, recipientAddress: lp },
      state,
    );
    const { intent: approved, registry } = approveWithdrawal(intent, position, withIntent);
    return { manifest, position, approved, registry };
  }

  function evidence(
    ctx: Awaited<ReturnType<typeof approvedWithdrawal>>,
    overrides: Partial<PayoutFinality> = {},
  ): PayoutFinality {
    return {
      status: 'confirmed',
      evidenceRef: 'idx-1',
      txpowId: 'tx-1',
      withdrawalId: ctx.approved.withdrawalId,
      poolId: ctx.manifest.poolId,
      positionId: ctx.position.positionId,
      recipientAddress: lp,
      amount: ctx.approved.amount.toString(),
      ...overrides,
    } as PayoutFinality;
  }

  const passVerifier = (): PayoutSettlementVerifier & { verifySettlement: jest.Mock } => ({
    verifySettlement: jest.fn(async () => ({ valid: true })),
  });

  it('refuses to settle when a settlement is supplied without a verifier', async () => {
    const ctx = await approvedWithdrawal();
    const before = serializeLiquidityBondState(ctx.registry);

    await expect(
      executePoolPayout(
        {
          pool: ctx.manifest,
          position: ctx.position,
          intent: ctx.approved,
          recipientAddress: lp,
          settlement: evidence(ctx),
        },
        ctx.registry,
      ),
    ).rejects.toThrow(/settlement verifier/);

    expect(serializeLiquidityBondState(ctx.registry)).toBe(before);
  });

  it('rejects a settlement the verifier cannot confirm and leaves the registry untouched', async () => {
    const ctx = await approvedWithdrawal();
    const before = serializeLiquidityBondState(ctx.registry);
    const verifier: PayoutSettlementVerifier = {
      verifySettlement: jest.fn(async () => ({ valid: false, reason: 'no such transaction' })),
    };

    await expect(
      executePoolPayout(
        {
          pool: ctx.manifest,
          position: ctx.position,
          intent: ctx.approved,
          recipientAddress: lp,
          settlement: evidence(ctx),
          settlementVerifier: verifier,
        },
        ctx.registry,
      ),
    ).rejects.toThrow(/not verified: no such transaction/);

    expect(serializeLiquidityBondState(ctx.registry)).toBe(before);
  });

  it('fails closed when the verifier throws', async () => {
    const ctx = await approvedWithdrawal();
    const verifier: PayoutSettlementVerifier = {
      verifySettlement: jest.fn(async () => {
        throw new Error('indexer unavailable');
      }),
    };

    await expect(
      executePoolPayout(
        {
          pool: ctx.manifest,
          position: ctx.position,
          intent: ctx.approved,
          recipientAddress: lp,
          settlement: evidence(ctx),
          settlementVerifier: verifier,
        },
        ctx.registry,
      ),
    ).rejects.toThrow(/indexer unavailable/);
  });

  it('does not accept a non-boolean verifier verdict', async () => {
    const ctx = await approvedWithdrawal();
    const verifier = {
      verifySettlement: jest.fn(async () => ({ valid: 'yes' as unknown as boolean })),
    };

    await expect(
      executePoolPayout(
        {
          pool: ctx.manifest,
          position: ctx.position,
          intent: ctx.approved,
          recipientAddress: lp,
          settlement: evidence(ctx),
          settlementVerifier: verifier,
        },
        ctx.registry,
      ),
    ).rejects.toThrow(/not verified/);
  });

  it.each([
    ['another withdrawal id', { withdrawalId: 'withdrawal-someone-else' }],
    ['another pool', { poolId: 'pool-2' }],
    ['another position', { positionId: 'position-someone-else' }],
    ['another recipient', { recipientAddress: 'MxATTACKER' }],
    ['another amount', { amount: '999999' }],
  ])('rejects settlement evidence for %s even when the verifier would pass it', async (_label, overrides) => {
    const ctx = await approvedWithdrawal();
    const before = serializeLiquidityBondState(ctx.registry);
    const verifier = passVerifier();

    await expect(
      executePoolPayout(
        {
          pool: ctx.manifest,
          position: ctx.position,
          intent: ctx.approved,
          recipientAddress: lp,
          settlement: evidence(ctx, overrides as Partial<PayoutFinality>),
          settlementVerifier: verifier,
        },
        ctx.registry,
      ),
    ).rejects.toThrow(/payout settlement/);

    // The binding is checked locally, before the verifier is even consulted.
    expect(verifier.verifySettlement).not.toHaveBeenCalled();
    expect(serializeLiquidityBondState(ctx.registry)).toBe(before);
  });

  it('rejects a redirected payout destination even with matching evidence', async () => {
    const ctx = await approvedWithdrawal();
    const before = serializeLiquidityBondState(ctx.registry);
    const verifier = passVerifier();

    await expect(
      executePoolPayout(
        {
          pool: ctx.manifest,
          position: ctx.position,
          intent: ctx.approved,
          recipientAddress: 'MxATTACKER',
          settlement: evidence(ctx, { recipientAddress: 'MxATTACKER' }),
          settlementVerifier: verifier,
        },
        ctx.registry,
      ),
    ).rejects.toThrow(/does not match the withdrawal intent owner/);

    expect(verifier.verifySettlement).not.toHaveBeenCalled();
    expect(serializeLiquidityBondState(ctx.registry)).toBe(before);
  });

  it('settles confirmed evidence and binds the verifier to the exact payout', async () => {
    const ctx = await approvedWithdrawal();
    const verifier = passVerifier();

    const result = await executePoolPayout(
      {
        pool: ctx.manifest,
        position: ctx.position,
        intent: ctx.approved,
        recipientAddress: lp,
        settlement: evidence(ctx, { depth: 6 }),
        settlementVerifier: verifier,
      },
      ctx.registry,
    );

    expect(verifier.verifySettlement).toHaveBeenCalledTimes(1);
    expect(verifier.verifySettlement).toHaveBeenCalledWith({
      settlement: expect.objectContaining({ status: 'confirmed', evidenceRef: 'idx-1', depth: 6 }),
      poolId: ctx.manifest.poolId,
      positionId: ctx.position.positionId,
      withdrawalId: ctx.approved.withdrawalId,
      recipientAddress: lp,
      amount: ctx.approved.amount,
    });
    expect(result.intent.status).toBe('settled-externally');
    expect(result.position.amount).toBe(ctx.position.amount - ctx.approved.amount);
  });

  it('settles offchain-final evidence', async () => {
    const ctx = await approvedWithdrawal();
    const verifier = passVerifier();

    const result = await executePoolPayout(
      {
        pool: ctx.manifest,
        position: ctx.position,
        intent: ctx.approved,
        recipientAddress: lp,
        settlement: evidence(ctx, { status: 'offchain-final', txpowId: undefined }),
        settlementVerifier: verifier,
      },
      ctx.registry,
    );

    expect(result.intent.status).toBe('settled-externally');
    expect(result.position.amount).toBe(99000n);
  });

  it('accepts the verifier from the execution context', async () => {
    const ctx = await approvedWithdrawal();
    const verifier = passVerifier();

    const result = await executePoolPayout(
      {
        pool: ctx.manifest,
        position: ctx.position,
        intent: ctx.approved,
        recipientAddress: lp,
        ctx: { settlementVerifier: verifier },
        settlement: evidence(ctx),
      },
      ctx.registry,
    );

    expect(verifier.verifySettlement).toHaveBeenCalled();
    expect(result.intent.status).toBe('settled-externally');
  });

  it('does not verify or settle when no settlement evidence is supplied', async () => {
    const ctx = await approvedWithdrawal();
    const verifier = passVerifier();

    const result = await executePoolPayout(
      {
        pool: ctx.manifest,
        position: ctx.position,
        intent: ctx.approved,
        recipientAddress: lp,
        settlementVerifier: verifier,
      },
      ctx.registry,
    );

    expect(verifier.verifySettlement).not.toHaveBeenCalled();
    expect(result.intent.status).toBe('approved');
    expect(result.position.amount).toBe(ctx.position.amount);
    expect(result.registry).toBe(ctx.registry);
  });
});
