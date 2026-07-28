import { applyLiquidityHaircut, computePositionRiskScore, computePoolUtilisation, detectDoubleCountedLiquidity } from '../risk.js';
import { createLiquidityPosition } from '../position.js';
import { createLiquidityCommitment } from '../commitment.js';
import { createLiquidityPoolManifest } from '../pool-manifest.js';

function makePool() {
  return createLiquidityPoolManifest({
    poolId: 'pool-1', poolType: 'omnia-router', purpose: 'omnia-router-liquidity',
    asset: 'MINIMA', lockTerms: { lockType: 'none' }, totalCapacity: 10000n, createdAt: 1000,
  });
}

function makePosition(utxoRef?: string) {
  const commitment = createLiquidityCommitment({
    poolId: 'pool-1', lpAddress: 'MxLP', asset: 'MINIMA', amount: 1000n,
    purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
  });
  return createLiquidityPosition({ commitment, poolId: 'pool-1', underlyingUtxoRef: utxoRef });
}

describe('risk', () => {
  describe('applyLiquidityHaircut', () => {
    it('applies haircut', () => {
      expect(applyLiquidityHaircut(1000n, 2000)).toBe(800n);
    });

    it('returns full amount with no haircut', () => {
      expect(applyLiquidityHaircut(1000n)).toBe(1000n);
    });
  });

  describe('computePositionRiskScore', () => {
    it('scores active position high', () => {
      const pool = makePool();
      const pos = makePosition();
      const score = computePositionRiskScore({ position: pos, pool });
      expect(score).toBeGreaterThanOrEqual(90);
    });

    it('scores depleted position zero', () => {
      const pool = makePool();
      const pos = { ...makePosition(), status: 'depleted' as const };
      expect(computePositionRiskScore({ position: pos, pool })).toBe(0);
    });
  });

  describe('computePoolUtilisation', () => {
    it('computes utilisation', () => {
      const pool = makePool();
      const pos = { ...makePosition(), allocatedAmount: 5000n };
      expect(computePoolUtilisation({ pool, positions: [pos] })).toBe(50);
    });
  });

  describe('detectDoubleCountedLiquidity', () => {
    it('detects double-counted utxo ref', () => {
      const pos1 = makePosition('utxo-1');
      const pos2 = makePosition('utxo-1');
      const result = detectDoubleCountedLiquidity([pos1, pos2]);
      expect(result.ok).toBe(false);
      expect(result.code).toBe('DOUBLE_COUNTED_LIQUIDITY');
    });

    it('passes for unique refs', () => {
      const pos1 = makePosition('utxo-1');
      const pos2 = makePosition('utxo-2');
      const result = detectDoubleCountedLiquidity([pos1, pos2]);
      expect(result.ok).toBe(true);
    });
  });
});
