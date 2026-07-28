import { recordLiquidityFee, sumFeesForPosition, sumLpFeesForPosition, verifyLiquidityFeeRecord } from '../fees.js';
import { createLiquidityPosition } from '../position.js';
import { createLiquidityCommitment } from '../commitment.js';

function makePosition() {
  const commitment = createLiquidityCommitment({
    poolId: 'pool-1', lpAddress: 'MxLP', asset: 'MINIMA', amount: 1000n,
    purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
  });
  return createLiquidityPosition({ commitment, poolId: 'pool-1' });
}

describe('fees', () => {
  describe('recordLiquidityFee', () => {
    it('records a fee', () => {
      const fee = recordLiquidityFee({
        positionId: 'pos-1', poolId: 'pool-1', feeAsset: 'MINIMA',
        grossFeeAmount: 10n, lpFeeAmount: 8n, operatorFeeAmount: 2n, source: 'route-fee',
      });
      expect(fee.grossFeeAmount).toBe(10n);
      expect(fee.lpFeeAmount).toBe(8n);
    });
  });

  describe('sumFeesForPosition', () => {
    it('sums fees for a position', () => {
      const f1 = recordLiquidityFee({
        positionId: 'pos-1', poolId: 'pool-1', feeAsset: 'MINIMA',
        grossFeeAmount: 10n, source: 'route-fee',
      });
      const f2 = recordLiquidityFee({
        positionId: 'pos-1', poolId: 'pool-1', feeAsset: 'MINIMA',
        grossFeeAmount: 20n, source: 'route-fee',
      });
      const f3 = recordLiquidityFee({
        positionId: 'pos-2', poolId: 'pool-1', feeAsset: 'MINIMA',
        grossFeeAmount: 5n, source: 'route-fee',
      });
      expect(sumFeesForPosition([f1, f2, f3], 'pos-1')).toBe(30n);
    });
  });

  describe('sumLpFeesForPosition', () => {
    it('sums LP fees for a position', () => {
      const f1 = recordLiquidityFee({
        positionId: 'pos-1', poolId: 'pool-1', feeAsset: 'MINIMA',
        grossFeeAmount: 10n, lpFeeAmount: 8n, source: 'route-fee',
      });
      expect(sumLpFeesForPosition([f1], 'pos-1')).toBe(8n);
    });
  });

  describe('verifyLiquidityFeeRecord', () => {
    it('verifies a valid fee record', () => {
      const pos = makePosition();
      const fee = recordLiquidityFee({
        positionId: pos.positionId, poolId: 'pool-1', feeAsset: 'MINIMA',
        grossFeeAmount: 10n, source: 'route-fee',
      });
      const result = verifyLiquidityFeeRecord({ record: fee, position: pos });
      expect(result.ok).toBe(true);
    });

    it('rejects mismatched position ID', () => {
      const pos = makePosition();
      const fee = recordLiquidityFee({
        positionId: 'wrong-id', poolId: 'pool-1', feeAsset: 'MINIMA',
        grossFeeAmount: 10n, source: 'route-fee',
      });
      const result = verifyLiquidityFeeRecord({ record: fee, position: pos });
      expect(result.ok).toBe(false);
    });
  });
});
