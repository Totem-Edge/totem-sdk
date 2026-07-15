import {
  createLiquidityPoolManifest,
  computeLiquidityPoolManifestHash,
  verifyLiquidityPoolManifest,
  assertLiquidityPoolManifestNotExpired,
} from '../pool-manifest.js';
import type { LiquidityPoolManifest } from '../types.js';

function makePool(overrides: Partial<LiquidityPoolManifest> = {}): LiquidityPoolManifest {
  return createLiquidityPoolManifest({
    poolId: 'pool-1',
    poolType: 'omnia-router',
    purpose: 'omnia-router-liquidity',
    asset: 'MINIMA',
    lockTerms: { lockType: 'none' },
    createdAt: 1000,
    ...overrides,
  });
}

describe('pool-manifest', () => {
  describe('createLiquidityPoolManifest', () => {
    it('creates a pool manifest', () => {
      const pool = makePool();
      expect(pool.poolId).toBe('pool-1');
      expect(pool.poolType).toBe('omnia-router');
      expect(pool.asset).toBe('MINIMA');
    });
  });

  describe('computeLiquidityPoolManifestHash', () => {
    it('computes a deterministic hash', () => {
      const pool = makePool();
      const h1 = computeLiquidityPoolManifestHash(pool);
      const h2 = computeLiquidityPoolManifestHash(pool);
      expect(h1).toBe(h2);
    });

    it('produces different hashes for different pools', () => {
      const h1 = computeLiquidityPoolManifestHash(makePool({ poolId: 'pool-1' }));
      const h2 = computeLiquidityPoolManifestHash(makePool({ poolId: 'pool-2' }));
      expect(h1).not.toBe(h2);
    });
  });

  describe('verifyLiquidityPoolManifest', () => {
    it('returns ok for valid manifest', () => {
      const pool = makePool();
      const result = verifyLiquidityPoolManifest({ manifest: pool });
      expect(result.ok).toBe(true);
    });

    it('rejects expired manifest', () => {
      const pool = makePool({ expiresAt: 500 });
      const result = verifyLiquidityPoolManifest({ manifest: pool, now: 2000 });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('POOL_MANIFEST_EXPIRED');
    });
  });

  describe('assertLiquidityPoolManifestNotExpired', () => {
    it('does not throw for non-expired', () => {
      expect(() => assertLiquidityPoolManifestNotExpired(makePool(), 500)).not.toThrow();
    });

    it('throws for expired', () => {
      expect(() => assertLiquidityPoolManifestNotExpired(makePool({ expiresAt: 500 }), 2000)).toThrow();
    });
  });
});
