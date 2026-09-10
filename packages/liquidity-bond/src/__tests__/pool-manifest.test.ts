import {
  createLiquidityPoolManifest,
  computeLiquidityPoolManifestHash,
  verifyLiquidityPoolManifest,
  assertLiquidityPoolManifestNotExpired,
  buildOperatorAutobond,
  verifyOperatorAutobond,
  computeOperatorAutobondPayloadHash,
  OPERATOR_AUTOBOND_DOMAIN,
  type OperatorAutobondSigner,
} from '../pool-manifest.js';
import type { LiquidityPoolManifest } from '../types.js';
import { bytesToHex, scriptFromWotsPk, scriptToAddress, wotsKeypairFromSeed, wotsSign } from '@totemsdk/core';

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

function makeOperatorSigner(seed: Uint8Array, index = 0): OperatorAutobondSigner {
  const kp = wotsKeypairFromSeed(seed, index);
  return {
    publicKeyDigest: bytesToHex(kp.pk),
    address: scriptToAddress(scriptFromWotsPk(kp.pk)),
    sign: (digest, _indices) => wotsSign(kp.seed, kp.index, digest),
  };
}
const OPERATOR_SEED = new Uint8Array(32).fill(11);

async function poolWithBond(index = 0): Promise<LiquidityPoolManifest> {
  const signer = makeOperatorSigner(OPERATOR_SEED, index);
  const pool = makePool({ operatorAddress: signer.address });
  const bond = await buildOperatorAutobond(pool, signer, 1500);
  return { ...pool, operatorBond: bond };
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

  describe('operator autobond', () => {
    it('binds the operator to pool parameters', async () => {
      const pool = await poolWithBond();
      expect(pool.operatorBond?.address).toBe(pool.operatorAddress);
      expect(pool.operatorBond?.payloadHash).toBe(computeOperatorAutobondPayloadHash(pool));
      expect(verifyOperatorAutobond(pool.operatorBond!, pool)).toBe(true);
    });

    it('changes when load-bearing parameters change', async () => {
      const pool = await poolWithBond();
      const original = computeOperatorAutobondPayloadHash(pool);
      const tampered = { ...pool, totalCapacity: (pool.totalCapacity ?? 0n) + 1n };
      expect(computeOperatorAutobondPayloadHash(tampered)).not.toBe(original);
      expect(verifyOperatorAutobond(pool.operatorBond!, tampered)).toBe(false);
    });

    it('rejects a bond forged by a different key', async () => {
      const attackerSigner = makeOperatorSigner(new Uint8Array(32).fill(99));
      const pool = makePool({ operatorAddress: attackerSigner.address });
      const forged = await buildOperatorAutobond(pool, attackerSigner, 1500);
      // claim the operator IS the victim pool operator, but bind with attacker key
      const claimant = { ...pool, operatorAddress: attackerSigner.address };
      expect(verifyOperatorAutobond(forged, claimant)).toBe(true);
      // a pool claiming the attacker key while operatorAddress differs fails
      const mismatch: LiquidityPoolManifest = { ...pool, operatorBond: forged, operatorAddress: 'MxREALOPERATOR' };
      expect(verifyOperatorAutobond(mismatch.operatorBond!, mismatch)).toBe(false);
      const result = verifyLiquidityPoolManifest({ manifest: mismatch, requireOperatorBond: true });
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/autobond/);
    });

    it('verifyLiquidityPoolManifest requires the bond when asked', async () => {
      expect(verifyLiquidityPoolManifest({ manifest: makePool(), requireOperatorBond: true }).ok).toBe(false);
      const bonded = await poolWithBond();
      expect(verifyLiquidityPoolManifest({ manifest: bonded, requireOperatorBond: true }).ok).toBe(true);
    });
  });
});
