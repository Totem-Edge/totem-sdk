import {
  createLiquidityPosition,
  activateLiquidityPosition,
  markLiquidityPositionDepleted,
  markLiquidityPositionInvalid,
  computeAvailableLiquidity,
  computeEffectiveLiquidityAmount,
  verifyLiquidityPosition,
} from '../position.js';
import { createLiquidityCommitment } from '../commitment.js';
import { createLiquidityPoolManifest } from '../pool-manifest.js';

function makePool() {
  return createLiquidityPoolManifest({
    poolId: 'pool-1', poolType: 'omnia-router', purpose: 'omnia-router-liquidity',
    asset: 'MINIMA', lockTerms: { lockType: 'none' }, createdAt: 1000,
  });
}

function makeCommitment() {
  return createLiquidityCommitment({
    poolId: 'pool-1', lpAddress: 'MxLP', asset: 'MINIMA', amount: 1000n,
    purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
  });
}

describe('position', () => {
  describe('createLiquidityPosition', () => {
    it('creates a position from commitment', () => {
      const commitment = makeCommitment();
      const pos = createLiquidityPosition({ commitment, poolId: 'pool-1' });
      expect(pos.status).toBe('active');
      expect(pos.amount).toBe(1000n);
      expect(pos.availableAmount).toBe(1000n);
    });
  });

  describe('activateLiquidityPosition', () => {
    it('activates a position', () => {
      const pos = createLiquidityPosition({ commitment: makeCommitment(), poolId: 'pool-1' });
      const activated = activateLiquidityPosition(pos);
      expect(activated.status).toBe('active');
    });
  });

  describe('computeAvailableLiquidity', () => {
    it('computes available liquidity', () => {
      const pos = createLiquidityPosition({ commitment: makeCommitment(), poolId: 'pool-1' });
      expect(computeAvailableLiquidity(pos)).toBe(1000n);
    });

    it('subtracts allocated amount', () => {
      const pos = { ...createLiquidityPosition({ commitment: makeCommitment(), poolId: 'pool-1' }), allocatedAmount: 300n };
      expect(computeAvailableLiquidity(pos)).toBe(700n);
    });
  });

  describe('computeEffectiveLiquidityAmount', () => {
    it('applies haircut', () => {
      const pos = createLiquidityPosition({ commitment: makeCommitment(), poolId: 'pool-1' });
      const effective = computeEffectiveLiquidityAmount(pos, { haircutBps: 2000 });
      expect(effective).toBe(800n);
    });
  });

  describe('markLiquidityPositionDepleted', () => {
    it('marks position depleted', () => {
      const pos = createLiquidityPosition({ commitment: makeCommitment(), poolId: 'pool-1' });
      const depleted = markLiquidityPositionDepleted(pos);
      expect(depleted.status).toBe('depleted');
    });
  });

  describe('markLiquidityPositionInvalid', () => {
    it('marks position invalid', () => {
      const pos = createLiquidityPosition({ commitment: makeCommitment(), poolId: 'pool-1' });
      const invalid = markLiquidityPositionInvalid(pos, 'test');
      expect(invalid.status).toBe('invalid');
    });
  });

  describe('verifyLiquidityPosition', () => {
    it('verifies a valid position', () => {
      const pool = makePool();
      const pos = createLiquidityPosition({ commitment: makeCommitment(), poolId: 'pool-1' });
      const result = verifyLiquidityPosition({ position: pos, pool });
      expect(result.ok).toBe(true);
    });

    it('rejects depleted position', () => {
      const pool = makePool();
      const pos = markLiquidityPositionDepleted(createLiquidityPosition({ commitment: makeCommitment(), poolId: 'pool-1' }));
      const result = verifyLiquidityPosition({ position: pos, pool });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('POSITION_DEPLETED');
    });
  });
});
