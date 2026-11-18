/**
 * OMN-005 — fee verification and settled-payout binding.
 *
 * A caller-controlled `verified` flag must never make a fee earnable, and a
 * claim/compound must consume a payout that a verifier confirmed as settled —
 * unknown, mismatched and reused payout references are rejected.
 */

import {
  computeRegistryRoot,
  createEmptyLiquidityBondRegistryState,
  registerSettledFeePayout,
  serializeLiquidityBondState,
  type FeeProofVerifier,
  type FeePayoutRef,
  type LiquidityBondRegistryState,
  type PayoutSettlementVerifier,
} from '@totemsdk/liquidity-bond';
import {
  claimFees,
  compoundFees,
  computeUnclaimedFees,
  createOmniaPool,
  depositToPool,
  recordPoolFee,
  type CreateOmniaPoolParams,
} from '../index.js';

describe('omnia-pool fee verification (OMN-005)', () => {
  const tokenId = '0x00';
  const operator = 'MxOPERATOR';
  const lp = 'MxLP';
  let fundingSeq = 0;

  const passFundingVerifier = {
    verifyDeposit: jest.fn(async () => ({ valid: true })),
  };

  const passFeeProofVerifier = (): FeeProofVerifier & { verifyFeeProof: jest.Mock } => ({
    verifyFeeProof: jest.fn(async () => ({ valid: true })),
  });

  const passSettlementVerifier = (): PayoutSettlementVerifier & { verifySettlement: jest.Mock } => ({
    verifySettlement: jest.fn(async () => ({ valid: true })),
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

  async function withPosition(amount = '100000') {
    const empty = createEmptyLiquidityBondRegistryState();
    const { manifest, registry: poolReg } = createOmniaPool(basePoolParams(), empty);
    fundingSeq++;
    const { position, state } = await depositToPool(
      {
        pool: manifest,
        lpAddress: lp,
        amount,
        purpose: 'omnia-channel-capital',
        underlyingUtxoRef: `0xFEE${fundingSeq}`,
        chainProvider: passFundingVerifier,
      },
      poolReg,
    );
    return { manifest, position, registry: state };
  }

  function payoutRef(payoutId: string, nonce = 'n1'): FeePayoutRef {
    return { payoutId, nonce, kind: 'vtxo-mint' };
  }

  async function settlePayout(
    registry: LiquidityBondRegistryState,
    ref: FeePayoutRef,
    positionId: string,
    amount: bigint,
    verifier: PayoutSettlementVerifier = passSettlementVerifier(),
  ) {
    return registerSettledFeePayout(registry, {
      payoutRef: ref,
      positionId,
      poolId: 'pool-1',
      amount,
      settlement: { status: 'confirmed', evidenceRef: `ev-${ref.payoutId}`, txpowId: 'tx-fee' },
      verifier,
    });
  }

  it('does not make a fee earnable from a caller-supplied verified flag', async () => {
    const { manifest, position, registry } = await withPosition();

    // A recorder forges the old boolean flag: no verifier is supplied at all.
    const { feeRecord, registry: feeReg } = await recordPoolFee(
      {
        pool: manifest,
        position,
        grossAmount: '10000',
        source: 'route-fee',
        earnProof: { htlcId: 'h-1' },
        verified: true,
      } as never,
      registry,
    );

    // Kept for audit, but non-earnable.
    expect(feeReg.feeRecords[position.positionId]).toHaveLength(1);
    expect(feeRecord.verified).toBe(false);
    expect(computeUnclaimedFees(position, feeReg)).toBe(0n);
  });

  it('does not make a fee earnable when the fee-proof verifier rejects it', async () => {
    const { manifest, position, registry } = await withPosition();
    const verifier: FeeProofVerifier = {
      verifyFeeProof: jest.fn(async () => ({ valid: false, reason: 'no matching HTLC fulfillment' })),
    };

    const { feeRecord, registry: feeReg } = await recordPoolFee(
      {
        pool: manifest,
        position,
        grossAmount: '10000',
        source: 'route-fee',
        earnProof: { htlcId: 'forged' },
        verified: true,
        feeProofVerifier: verifier,
      } as never,
      registry,
    );

    expect(verifier.verifyFeeProof).toHaveBeenCalledTimes(1);
    expect(feeRecord.verified).toBe(false);
    expect(computeUnclaimedFees(position, feeReg)).toBe(0n);
  });

  it('credits the LP when the fee proof verifies', async () => {
    const { manifest, position, registry } = await withPosition();
    const verifier = passFeeProofVerifier();

    const { feeRecord, registry: feeReg } = await recordPoolFee(
      {
        pool: manifest,
        position,
        grossAmount: '10000',
        source: 'route-fee',
        earnProof: { htlcId: 'h-1' },
        feeProofVerifier: verifier,
      },
      registry,
    );

    expect(verifier.verifyFeeProof).toHaveBeenCalledWith({
      source: 'route-fee',
      proof: { htlcId: 'h-1' },
      positionId: position.positionId,
      poolId: manifest.poolId,
      grossAmount: 10000n,
    });
    expect(feeRecord.verified).toBe(true);
    expect(computeUnclaimedFees(position, feeReg)).toBe(50n);
  });

  it('rejects an unknown payoutRef without releasing fees', async () => {
    const { manifest, position, registry } = await withPosition();
    const { registry: feeReg } = await recordPoolFee(
      {
        pool: manifest,
        position,
        grossAmount: '10000',
        source: 'route-fee',
        earnProof: { htlcId: 'h-1' },
        feeProofVerifier: passFeeProofVerifier(),
      },
      registry,
    );
    const before = serializeLiquidityBondState(feeReg);

    expect(() =>
      claimFees(manifest, position, feeReg, {
        positionId: position.positionId,
        amount: '20',
        payoutRef: payoutRef('forged-payout'),
      }),
    ).toThrow(/unknown payoutRef/);

    expect(serializeLiquidityBondState(feeReg)).toBe(before);
    expect(computeUnclaimedFees(position, feeReg)).toBe(50n);
  });

  it('rejects a compound with an unknown payoutRef', async () => {
    const { manifest, position, registry } = await withPosition();
    const { registry: feeReg } = await recordPoolFee(
      {
        pool: manifest,
        position,
        grossAmount: '10000',
        source: 'route-fee',
        earnProof: { htlcId: 'h-1' },
        feeProofVerifier: passFeeProofVerifier(),
      },
      registry,
    );
    const before = serializeLiquidityBondState(feeReg);

    expect(() =>
      compoundFees(manifest, position, feeReg, {
        positionId: position.positionId,
        payoutRef: payoutRef('forged-payout'),
      }),
    ).toThrow(/unknown payoutRef/);

    expect(serializeLiquidityBondState(feeReg)).toBe(before);
  });

  it('rejects an unknown payoutRef even when there is nothing to compound', async () => {
    const { manifest, position, registry } = await withPosition();
    expect(computeUnclaimedFees(position, registry)).toBe(0n);

    expect(() =>
      compoundFees(manifest, position, registry, {
        positionId: position.positionId,
        payoutRef: payoutRef('forged-payout'),
      }),
    ).toThrow(/unknown payoutRef/);
  });

  it('consumes a verified settled payout exactly once', async () => {
    const { manifest, position, registry } = await withPosition();
    const { registry: feeReg } = await recordPoolFee(
      {
        pool: manifest,
        position,
        grossAmount: '10000',
        source: 'route-fee',
        earnProof: { htlcId: 'h-1' },
        feeProofVerifier: passFeeProofVerifier(),
      },
      registry,
    );

    const ref = payoutRef('payout-1');
    const { registry: withPayout } = await settlePayout(feeReg, ref, position.positionId, 50n);
    const claimed = claimFees(manifest, position, withPayout, {
      positionId: position.positionId,
      amount: '20',
      payoutRef: ref,
    });

    expect(claimed.claimedAmount).toBe(20n);
    expect(computeUnclaimedFees(position, claimed.registry)).toBe(30n);

    // The same payout cannot release fees a second time.
    expect(() =>
      claimFees(manifest, position, claimed.registry, {
        positionId: position.positionId,
        amount: '10',
        payoutRef: ref,
      }),
    ).toThrow(/already been consumed/);
    expect(() =>
      compoundFees(manifest, position, claimed.registry, {
        positionId: position.positionId,
        payoutRef: ref,
      }),
    ).toThrow(/already been consumed/);
  });

  it('rejects a payoutRef bound to another position or pool', async () => {
    const first = await withPosition();
    // A second position in the same registry, so the payout can be registered
    // against it (and must still be rejected for the first position's claim).
    fundingSeq++;
    const second = await depositToPool(
      {
        pool: first.manifest,
        lpAddress: lp,
        amount: '100000',
        purpose: 'omnia-channel-capital',
        underlyingUtxoRef: `0xFEE${fundingSeq}`,
        chainProvider: passFundingVerifier,
      },
      first.registry,
    );
    const { registry: feeReg } = await recordPoolFee(
      {
        pool: first.manifest,
        position: first.position,
        grossAmount: '10000',
        source: 'route-fee',
        earnProof: { htlcId: 'h-1' },
        feeProofVerifier: passFeeProofVerifier(),
      },
      second.state,
    );

    // A settled payout for a different position cannot back this claim.
    const { registry: withForeignPayout } = await settlePayout(
      feeReg,
      payoutRef('payout-other-position'),
      second.position.positionId,
      50n,
    );

    expect(() =>
      claimFees(first.manifest, first.position, withForeignPayout, {
        positionId: first.position.positionId,
        amount: '20',
        payoutRef: payoutRef('payout-other-position'),
      }),
    ).toThrow(/bound to position/);
  });

  it('rejects a claim larger than the settled payout', async () => {
    const { manifest, position, registry } = await withPosition();
    const { registry: feeReg } = await recordPoolFee(
      {
        pool: manifest,
        position,
        grossAmount: '10000',
        source: 'route-fee',
        earnProof: { htlcId: 'h-1' },
        feeProofVerifier: passFeeProofVerifier(),
      },
      registry,
    );
    const ref = payoutRef('payout-small');
    const { registry: withPayout } = await settlePayout(feeReg, ref, position.positionId, 10n);

    expect(() =>
      claimFees(manifest, position, withPayout, {
        positionId: position.positionId,
        amount: '20',
        payoutRef: ref,
      }),
    ).toThrow(/exceeds settled payout amount/);
  });

  it('does not register a settled payout without verified evidence', async () => {
    const { manifest, position, registry } = await withPosition();
    const { registry: feeReg } = await recordPoolFee(
      {
        pool: manifest,
        position,
        grossAmount: '10000',
        source: 'route-fee',
        earnProof: { htlcId: 'h-1' },
        feeProofVerifier: passFeeProofVerifier(),
      },
      registry,
    );
    const before = serializeLiquidityBondState(feeReg);

    await expect(
      registerSettledFeePayout(feeReg, {
        payoutRef: payoutRef('forged'),
        positionId: position.positionId,
        poolId: manifest.poolId,
        amount: 50n,
        settlement: { status: 'confirmed', evidenceRef: 'made-up', txpowId: 'tx-made-up' },
        verifier: {
          verifySettlement: async () => ({ valid: false, reason: 'transaction not found' }),
        },
      }),
    ).rejects.toThrow(/not verified: transaction not found/);

    // No verifier at all is also rejected.
    await expect(
      registerSettledFeePayout(feeReg, {
        payoutRef: payoutRef('forged-2'),
        positionId: position.positionId,
        poolId: manifest.poolId,
        amount: 50n,
        settlement: { status: 'offchain-final', evidenceRef: 'made-up' },
        verifier: {} as never,
      }),
    ).rejects.toThrow(/settlement verifier/);

    expect(serializeLiquidityBondState(feeReg)).toBe(before);
  });

  it('rejects re-registering the same payout reference', async () => {
    const { position, registry } = await withPosition();
    const ref = payoutRef('payout-once');
    const { registry: once } = await settlePayout(registry, ref, position.positionId, 50n);

    await expect(settlePayout(once, ref, position.positionId, 50n)).rejects.toThrow(
      /already registered as a settled payout/,
    );
  });

  it('leaves fee accounting unchanged on rejection (root is stable)', async () => {
    const { manifest, position, registry } = await withPosition();
    const { registry: feeReg } = await recordPoolFee(
      {
        pool: manifest,
        position,
        grossAmount: '10000',
        source: 'route-fee',
        earnProof: { htlcId: 'h-1' },
        feeProofVerifier: passFeeProofVerifier(),
      },
      registry,
    );
    const root = computeRegistryRoot(feeReg);

    expect(() =>
      claimFees(manifest, position, feeReg, {
        positionId: position.positionId,
        amount: '20',
        payoutRef: payoutRef('forged-payout'),
      }),
    ).toThrow();

    expect(computeRegistryRoot(feeReg)).toBe(root);
  });
});
