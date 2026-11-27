import {
  recordLiquidityFee,
  sumFeesForPosition,
  sumLpFeesForPosition,
  verifyLiquidityFeeRecord,
  isEarnableSource,
  computeFeePayoutKey,
  getSettledFeePayout,
  registerSettledFeePayout,
  consumeSettledFeePayout,
} from '../fees.js';
import { createLiquidityPosition } from '../position.js';
import { createLiquidityCommitment } from '../commitment.js';
import { attachLiquidityFeeRecord, createEmptyLiquidityBondRegistryState, registerLiquidityPosition } from '../registry.js';

function makePosition() {
  const commitment = createLiquidityCommitment({
    poolId: 'pool-1', lpAddress: 'MxLP', asset: 'MINIMA', amount: 1000n,
    purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
  });
  return createLiquidityPosition({ commitment, poolId: 'pool-1' });
}

const passVerifier = {
  verifyFeeProof: async () => ({ valid: true }),
};

const failVerifier = {
  verifyFeeProof: async () => ({ valid: false, reason: 'no matching HTLC fulfillment' }),
};

describe('OMN-125: fee evidence is consumed once', () => {
  function record(htlcId: string) {
    return recordLiquidityFee({
      positionId: 'pos-1',
      poolId: 'pool-1',
      feeAsset: 'MINIMA',
      grossFeeAmount: 10n,
      lpFeeAmount: 8n,
      operatorFeeAmount: 2n,
      source: 'route-fee',
      earnProof: { htlcId },
    });
  }

  it('rejects the same earn-proof recorded twice for a position', () => {
    let state = createEmptyLiquidityBondRegistryState();
    state = attachLiquidityFeeRecord(state, record('h-1'));
    expect(() => attachLiquidityFeeRecord(state, record('h-1'))).toThrow(/already recorded/);
  });

  it('keeps distinct evidence and distinct sources', () => {
    let state = createEmptyLiquidityBondRegistryState();
    state = attachLiquidityFeeRecord(state, record('h-1'));
    state = attachLiquidityFeeRecord(state, record('h-2'));
    const otherSource = { ...record('h-1'), source: 'rfq-spread' as const };
    state = attachLiquidityFeeRecord(state, otherSource);
    expect(state.feeRecords['pos-1']).toHaveLength(3);
  });

  it('allows multiple non-earnable adjustments without evidence', () => {
    let state = createEmptyLiquidityBondRegistryState();
    const adjustment = recordLiquidityFee({
      positionId: 'pos-1', poolId: 'pool-1', feeAsset: 'MINIMA',
      grossFeeAmount: 1n, source: 'manual-adjustment',
    });
    state = attachLiquidityFeeRecord(state, adjustment);
    state = attachLiquidityFeeRecord(state, { ...adjustment, feeRecordId: 'fee-2' });
    expect(state.feeRecords['pos-1']).toHaveLength(2);
  });
});

describe('fees', () => {
  describe('recordLiquidityFee', () => {
    it('records a fee', () => {
      const fee = recordLiquidityFee({
        positionId: 'pos-1', poolId: 'pool-1', feeAsset: 'MINIMA',
        grossFeeAmount: 10n, lpFeeAmount: 8n, operatorFeeAmount: 2n, source: 'route-fee',
        earnProof: { htlcId: 'h-1' },
      });
      expect(fee.grossFeeAmount).toBe(10n);
      expect(fee.lpFeeAmount).toBe(8n);
    });

    it('requires an earn-proof for earnable sources', () => {
      expect(() =>
        recordLiquidityFee({
          positionId: 'pos-1', poolId: 'pool-1', feeAsset: 'MINIMA',
          grossFeeAmount: 10n, source: 'route-fee',
        }),
      ).toThrow(/requires an earn-proof/);
    });

    it('rejects lpFee + operatorFee exceeding gross', () => {
      expect(() =>
        recordLiquidityFee({
          positionId: 'pos-1', poolId: 'pool-1', feeAsset: 'MINIMA',
          grossFeeAmount: 10n, lpFeeAmount: 9n, operatorFeeAmount: 2n, source: 'manual-adjustment',
        }),
      ).toThrow(/must not exceed gross/);
    });
  });

  describe('sumFeesForPosition', () => {
    it('sums fees for a position', () => {
      const f1 = recordLiquidityFee({
        positionId: 'pos-1', poolId: 'pool-1', feeAsset: 'MINIMA',
        grossFeeAmount: 10n, source: 'manual-adjustment',
      });
      const f2 = recordLiquidityFee({
        positionId: 'pos-1', poolId: 'pool-1', feeAsset: 'MINIMA',
        grossFeeAmount: 20n, source: 'manual-adjustment',
      });
      const f3 = recordLiquidityFee({
        positionId: 'pos-2', poolId: 'pool-1', feeAsset: 'MINIMA',
        grossFeeAmount: 5n, source: 'manual-adjustment',
      });
      expect(sumFeesForPosition([f1, f2, f3], 'pos-1')).toBe(30n);
    });
  });

  describe('sumLpFeesForPosition', () => {
    it('sums LP fees for a position', () => {
      const f1 = recordLiquidityFee({
        positionId: 'pos-1', poolId: 'pool-1', feeAsset: 'MINIMA',
        grossFeeAmount: 10n, lpFeeAmount: 8n, source: 'manual-adjustment',
      });
      expect(sumLpFeesForPosition([f1], 'pos-1')).toBe(8n);
    });

    it('excludes unverified earnable records from LP entitlement', () => {
      const unverified = recordLiquidityFee({
        positionId: 'pos-1', poolId: 'pool-1', feeAsset: 'MINIMA',
        grossFeeAmount: 10n, lpFeeAmount: 8n, source: 'route-fee',
        earnProof: { htlcId: 'h-1' },
      });
      const verified = recordLiquidityFee({
        positionId: 'pos-1', poolId: 'pool-1', feeAsset: 'MINIMA',
        grossFeeAmount: 10n, lpFeeAmount: 8n, source: 'route-fee',
        earnProof: { htlcId: 'h-2' }, verified: true,
      });
      expect(sumLpFeesForPosition([unverified, verified], 'pos-1')).toBe(8n);
    });
  });

  describe('verifyLiquidityFeeRecord', () => {
    it('verifies a valid non-earnable record', async () => {
      const pos = makePosition();
      const fee = recordLiquidityFee({
        positionId: pos.positionId, poolId: 'pool-1', feeAsset: 'MINIMA',
        grossFeeAmount: 10n, source: 'manual-adjustment',
      });
      const result = await verifyLiquidityFeeRecord({ record: fee, position: pos });
      expect(result.ok).toBe(true);
    });

    it('requires a live verifier for earnable records', async () => {
      const pos = makePosition();
      const fee = recordLiquidityFee({
        positionId: pos.positionId, poolId: 'pool-1', feeAsset: 'MINIMA',
        grossFeeAmount: 10n, source: 'route-fee', earnProof: { htlcId: 'h-1' },
      });
      const result = await verifyLiquidityFeeRecord({ record: fee, position: pos });
      expect(result.ok).toBe(false);
      expect(result.requiresLiveVerifier).toBe(true);

      const ok = await verifyLiquidityFeeRecord({ record: fee, position: pos, feeProofVerifier: passVerifier });
      expect(ok.ok).toBe(true);

      const bad = await verifyLiquidityFeeRecord({ record: fee, position: pos, feeProofVerifier: failVerifier });
      expect(bad.ok).toBe(false);
      expect(bad.reason).toMatch(/earn-proof failed/);
    });

    it('rejects mismatched position ID', async () => {
      const pos = makePosition();
      const fee = recordLiquidityFee({
        positionId: 'wrong-id', poolId: 'pool-1', feeAsset: 'MINIMA',
        grossFeeAmount: 10n, source: 'manual-adjustment',
      });
      const result = await verifyLiquidityFeeRecord({ record: fee, position: pos });
      expect(result.ok).toBe(false);
    });
  });

  describe('isEarnableSource', () => {
    it('classifies earnable sources', () => {
      expect(isEarnableSource('route-fee')).toBe(true);
      expect(isEarnableSource('rfq-spread')).toBe(true);
      expect(isEarnableSource('merchant-fee')).toBe(true);
      expect(isEarnableSource('manual-adjustment')).toBe(false);
    });
  });

  describe('settled fee payouts', () => {
    const ref = { payoutId: 'payout-1', nonce: 'n1', kind: 'vtxo-mint' as const };
    const settlement = { status: 'confirmed' as const, evidenceRef: 'idx-1', txpowId: 'tx-1' };

    function makeRegistry() {
      const position = makePosition();
      const registry = registerLiquidityPosition(createEmptyLiquidityBondRegistryState(), position);
      return { position, registry };
    }

    const settleVerifier = () => ({
      verifySettlement: jest.fn(async () => ({ valid: true })),
    });

    it('records a payout only after the verifier confirms the settlement', async () => {
      const { position, registry } = makeRegistry();
      const verifier = settleVerifier();

      const { payout, registry: next } = await registerSettledFeePayout(registry, {
        payoutRef: ref,
        positionId: position.positionId,
        poolId: 'pool-1',
        amount: 50n,
        settlement,
        verifier,
      });

      expect(verifier.verifySettlement).toHaveBeenCalledWith({
        settlement,
        poolId: 'pool-1',
        positionId: position.positionId,
        recipientAddress: position.lpAddress,
        amount: 50n,
      });
      expect(payout.evidenceRef).toBe('idx-1');
      expect(getSettledFeePayout(next, ref)).toEqual(
        expect.objectContaining({ payoutId: 'payout-1', nonce: 'n1', amount: 50n, poolId: 'pool-1' }),
      );
    });

    it('fails closed without a verifier or when verification fails', async () => {
      const { position, registry } = makeRegistry();

      await expect(
        registerSettledFeePayout(registry, {
          payoutRef: ref,
          positionId: position.positionId,
          poolId: 'pool-1',
          amount: 50n,
          settlement,
          verifier: {} as never,
        }),
      ).rejects.toThrow(/settlement verifier/);

      await expect(
        registerSettledFeePayout(registry, {
          payoutRef: ref,
          positionId: position.positionId,
          poolId: 'pool-1',
          amount: 50n,
          settlement,
          verifier: { verifySettlement: async () => ({ valid: false, reason: 'unknown tx' }) },
        }),
      ).rejects.toThrow(/not verified: unknown tx/);

      expect(getSettledFeePayout(registry, ref)).toBeUndefined();
    });

    it('rejects an unbound payout (missing evidence) and an unknown position', async () => {
      const { position, registry } = makeRegistry();

      await expect(
        registerSettledFeePayout(registry, {
          payoutRef: ref,
          positionId: position.positionId,
          poolId: 'pool-1',
          amount: 50n,
          settlement: { status: 'confirmed', evidenceRef: '' },
          verifier: settleVerifier(),
        }),
      ).rejects.toThrow(/evidenceRef/);

      await expect(
        registerSettledFeePayout(registry, {
          payoutRef: ref,
          positionId: 'pos-missing',
          poolId: 'pool-1',
          amount: 50n,
          settlement,
          verifier: settleVerifier(),
        }),
      ).rejects.toThrow(/not registered/);

      await expect(
        registerSettledFeePayout(registry, {
          payoutRef: ref,
          positionId: position.positionId,
          poolId: 'pool-2',
          amount: 50n,
          settlement,
          verifier: settleVerifier(),
        }),
      ).rejects.toThrow(/does not belong to pool/);
    });

    it('rejects a reused payout reference', async () => {
      const { position, registry } = makeRegistry();
      const { registry: next } = await registerSettledFeePayout(registry, {
        payoutRef: ref,
        positionId: position.positionId,
        poolId: 'pool-1',
        amount: 50n,
        settlement,
        verifier: settleVerifier(),
      });

      await expect(
        registerSettledFeePayout(next, {
          payoutRef: { ...ref, kind: 'external' },
          positionId: position.positionId,
          poolId: 'pool-1',
          amount: 50n,
          settlement,
          verifier: settleVerifier(),
        }),
      ).rejects.toThrow(/already registered as a settled payout/);

      // The same settlement evidence cannot mint a second payout either.
      await expect(
        registerSettledFeePayout(next, {
          payoutRef: { payoutId: 'payout-2', nonce: 'n2', kind: 'vtxo-mint' },
          positionId: position.positionId,
          poolId: 'pool-1',
          amount: 50n,
          settlement,
          verifier: settleVerifier(),
        }),
      ).rejects.toThrow(/already backs payoutRef payout-1:n1/);
    });

    it('consumes a payout exactly once and enforces its binding', async () => {
      const { position, registry } = makeRegistry();
      const { registry: withPayout } = await registerSettledFeePayout(registry, {
        payoutRef: ref,
        positionId: position.positionId,
        poolId: 'pool-1',
        amount: 50n,
        settlement,
        verifier: settleVerifier(),
      });

      expect(() =>
        consumeSettledFeePayout(withPayout, { ...ref, kind: 'external' }, {
          positionId: position.positionId,
          poolId: 'pool-1',
          amount: 10n,
          consumedBy: 'fee-1',
        }),
      ).toThrow(/does not match the settled payout kind/);

      expect(() =>
        consumeSettledFeePayout(withPayout, ref, {
          positionId: 'pos-other',
          poolId: 'pool-1',
          amount: 10n,
          consumedBy: 'fee-1',
        }),
      ).toThrow(/bound to position/);

      expect(() =>
        consumeSettledFeePayout(withPayout, ref, {
          positionId: position.positionId,
          poolId: 'pool-1',
          amount: 51n,
          consumedBy: 'fee-1',
        }),
      ).toThrow(/exceeds settled payout amount/);

      const consumed = consumeSettledFeePayout(withPayout, ref, {
        positionId: position.positionId,
        poolId: 'pool-1',
        amount: 10n,
        consumedBy: 'fee-1',
      });
      expect(getSettledFeePayout(consumed, ref)).toEqual(
        expect.objectContaining({ consumedBy: 'fee-1' }),
      );

      expect(() =>
        consumeSettledFeePayout(consumed, ref, {
          positionId: position.positionId,
          poolId: 'pool-1',
          amount: 10n,
          consumedBy: 'fee-2',
        }),
      ).toThrow(/already been consumed/);
    });

    it('rejects an unknown payout reference', () => {
      const { position, registry } = makeRegistry();
      expect(() =>
        consumeSettledFeePayout(registry, ref, {
          positionId: position.positionId,
          poolId: 'pool-1',
          amount: 10n,
          consumedBy: 'fee-1',
        }),
      ).toThrow(/unknown payoutRef/);
      expect(computeFeePayoutKey(ref)).toBe('payout-1:n1');
    });
  });
});