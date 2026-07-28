import { validateLiquidityAgainstPolicy, filterLiquidityPositionsByPolicy, rankLiquidityPositionsByRisk } from '../policy.js';
import { createLiquidityPosition } from '../position.js';
import { createLiquidityCommitment } from '../commitment.js';
import { createLiquidityPoolManifest } from '../pool-manifest.js';
import { createEmptyLiquidityBondRegistryState, registerLiquidityPool, registerLiquidityPosition } from '../registry.js';
import type { LiquidityBondPolicy, LiquidityPositionStatus } from '../types.js';

function makePool(asset = 'MINIMA') {
  return createLiquidityPoolManifest({
    poolId: 'pool-1', poolType: 'omnia-router', purpose: 'omnia-router-liquidity',
    asset: asset as any, lockTerms: { lockType: 'none' }, createdAt: 1000,
  });
}

function makePosition(asset = 'MINIMA', status: LiquidityPositionStatus = 'active') {
  const commitment = createLiquidityCommitment({
    poolId: 'pool-1', lpAddress: 'MxLP', asset: asset as any, amount: 1000n,
    purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
  });
  const pos = createLiquidityPosition({ commitment, poolId: 'pool-1' });
  return { ...pos, status };
}

describe('policy', () => {
  describe('validateLiquidityAgainstPolicy', () => {
    it('MINIMA position passes MINIMA liquidity policy', () => {
      const pool = makePool('MINIMA');
      const pos = makePosition('MINIMA');
      const policy: LiquidityBondPolicy = { acceptedAssets: ['MINIMA'] };
      const result = validateLiquidityAgainstPolicy({ position: pos, pool, policy });
      expect(result.ok).toBe(true);
    });

    it('MxUSD passes only if accepted', () => {
      const pool = makePool('MxUSD');
      const pos = makePosition('MxUSD');
      const policy: LiquidityBondPolicy = { acceptedAssets: ['MINIMA'] };
      const result = validateLiquidityAgainstPolicy({ position: pos, pool, policy });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('ASSET_NOT_ACCEPTED');
    });

    it('other token fails unless explicitly accepted', () => {
      const pool = makePool('OTHER');
      const pos = makePosition('OTHER');
      const policy: LiquidityBondPolicy = { acceptedAssets: ['MINIMA'] };
      const result = validateLiquidityAgainstPolicy({ position: pos, pool, policy });
      expect(result.ok).toBe(false);
    });

    it('expired position fails', () => {
      const pool = makePool();
      const pos = { ...makePosition(), expiresAt: 500 };
      const policy: LiquidityBondPolicy = { rejectExpired: true, now: 2000 };
      const result = validateLiquidityAgainstPolicy({ position: pos, pool, policy });
      expect(result.ok).toBe(false);
    });

    it('depleted position fails', () => {
      const pool = makePool();
      const pos = makePosition('MINIMA', 'depleted');
      const policy: LiquidityBondPolicy = { rejectDepleted: true };
      const result = validateLiquidityAgainstPolicy({ position: pos, pool, policy });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('POSITION_DEPLETED');
    });

    it('withdrawable position fails if locked liquidity required', () => {
      const pool = makePool();
      const pos = makePosition('MINIMA', 'withdrawal-requested');
      const policy: LiquidityBondPolicy = {};
      const result = validateLiquidityAgainstPolicy({ position: pos, pool, policy });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('WITHDRAWAL_NOT_ALLOWED');
    });

    it('provider score rule works using ProviderBondRef', () => {
      const pool = makePool();
      const pos = { ...makePosition(), providerBondRef: { providerId: 'p-1', providerScore: 50 } };
      const policy: LiquidityBondPolicy = { minProviderScore: 80 };
      const result = validateLiquidityAgainstPolicy({ position: pos, pool, policy });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('PROVIDER_REF_INVALID');
    });
  });

  describe('filterLiquidityPositionsByPolicy', () => {
    it('filters positions by policy', () => {
      let state = createEmptyLiquidityBondRegistryState();
      const pool = makePool('MINIMA');
      state = registerLiquidityPool(state, pool);
      const pos1 = makePosition('MINIMA');
      const pos2 = makePosition('MxUSD');
      state = registerLiquidityPosition(state, pos1);
      state = registerLiquidityPosition(state, pos2);
      const policy: LiquidityBondPolicy = { acceptedAssets: ['MINIMA'] };
      const filtered = filterLiquidityPositionsByPolicy(state, policy);
      expect(filtered).toHaveLength(1);
    });
  });

  describe('rankLiquidityPositionsByRisk', () => {
    it('ranks active positions first', () => {
      const pos1 = makePosition('MINIMA', 'active');
      const pos2 = makePosition('MINIMA', 'quiescing');
      const ranked = rankLiquidityPositionsByRisk([pos2, pos1]);
      expect(ranked[0].status).toBe('active');
    });
  });
});
