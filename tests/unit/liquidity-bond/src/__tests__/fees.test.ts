import { recordLiquidityFee, sumFeesForPosition, sumLpFeesForPosition, verifyLiquidityFeeRecord, isEarnableSource } from '../fees.js';
import { createLiquidityPosition } from '../position.js';
import { createLiquidityCommitment } from '../commitment.js';

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
});