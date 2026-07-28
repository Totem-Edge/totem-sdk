import {
  createLiquidityCommitment,
  acceptLiquidityCommitment,
  rejectLiquidityCommitment,
  cancelLiquidityCommitment,
  verifyLiquidityCommitment,
} from '../commitment.js';
import { createLiquidityPoolManifest } from '../pool-manifest.js';

function makePool() {
  return createLiquidityPoolManifest({
    poolId: 'pool-1', poolType: 'omnia-router', purpose: 'omnia-router-liquidity',
    asset: 'MINIMA', lockTerms: { lockType: 'none' }, minCommitment: 100n, maxCommitment: 10000n, createdAt: 1000,
  });
}

describe('commitment', () => {
  describe('createLiquidityCommitment', () => {
    it('creates a commitment', () => {
      const c = createLiquidityCommitment({
        poolId: 'pool-1', lpAddress: 'MxLP', asset: 'MINIMA', amount: 1000n,
        purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
      });
      expect(c.status).toBe('draft');
      expect(c.amount).toBe(1000n);
    });
  });

  describe('acceptLiquidityCommitment', () => {
    it('accepts a commitment', () => {
      const c = createLiquidityCommitment({
        poolId: 'pool-1', lpAddress: 'MxLP', asset: 'MINIMA', amount: 1000n,
        purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
      });
      const accepted = acceptLiquidityCommitment(c);
      expect(accepted.status).toBe('accepted');
    });
  });

  describe('rejectLiquidityCommitment', () => {
    it('rejects a commitment', () => {
      const c = createLiquidityCommitment({
        poolId: 'pool-1', lpAddress: 'MxLP', asset: 'MINIMA', amount: 1000n,
        purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
      });
      const rejected = rejectLiquidityCommitment(c, 'too small');
      expect(rejected.status).toBe('rejected');
    });
  });

  describe('cancelLiquidityCommitment', () => {
    it('cancels a commitment', () => {
      const c = createLiquidityCommitment({
        poolId: 'pool-1', lpAddress: 'MxLP', asset: 'MINIMA', amount: 1000n,
        purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
      });
      const cancelled = cancelLiquidityCommitment(c);
      expect(cancelled.status).toBe('cancelled');
    });
  });

  describe('verifyLiquidityCommitment', () => {
    it('verifies a valid commitment', () => {
      const pool = makePool();
      const c = createLiquidityCommitment({
        poolId: 'pool-1', lpAddress: 'MxLP', asset: 'MINIMA', amount: 1000n,
        purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
      });
      const result = verifyLiquidityCommitment({ commitment: c, pool });
      expect(result.ok).toBe(true);
    });

    it('rejects commitment below minimum', () => {
      const pool = makePool();
      const c = createLiquidityCommitment({
        poolId: 'pool-1', lpAddress: 'MxLP', asset: 'MINIMA', amount: 50n,
        purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
      });
      const result = verifyLiquidityCommitment({ commitment: c, pool });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('AMOUNT_TOO_SMALL');
    });

    it('rejects expired commitment', () => {
      const pool = makePool();
      const c = createLiquidityCommitment({
        poolId: 'pool-1', lpAddress: 'MxLP', asset: 'MINIMA', amount: 1000n,
        purpose: 'omnia-router-liquidity', terms: { lockType: 'none' }, expiresAt: 500,
      });
      const result = verifyLiquidityCommitment({ commitment: c, pool, now: 2000 });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('COMMITMENT_EXPIRED');
    });
  });
});
