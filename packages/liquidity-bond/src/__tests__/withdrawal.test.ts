import {
  createWithdrawalIntent,
  computeWithdrawalId,
  approveWithdrawalIntent,
  rejectWithdrawalIntent,
  cancelWithdrawalIntent,
  verifyWithdrawalAllowed,
  WITHDRAWAL_ID_DOMAIN,
} from '../withdrawal.js';
import { createLiquidityPosition } from '../position.js';
import { createLiquidityCommitment } from '../commitment.js';
import { createLiquidityPoolManifest } from '../pool-manifest.js';

function makePool() {
  return createLiquidityPoolManifest({
    poolId: 'pool-1', poolType: 'omnia-router', purpose: 'omnia-router-liquidity',
    asset: 'MINIMA', lockTerms: { lockType: 'none' }, createdAt: 1000,
  });
}

function makePosition(lockType: 'none' | 'fixed-duration' = 'none') {
  const commitment = createLiquidityCommitment({
    poolId: 'pool-1', lpAddress: 'MxLP', asset: 'MINIMA', amount: 1000n,
    purpose: 'omnia-router-liquidity', terms: { lockType, unlockAfterMs: lockType === 'fixed-duration' ? 10000 : undefined },
    createdAt: 1000,
  });
  return createLiquidityPosition({ commitment, poolId: 'pool-1', createdAt: 1000 });
}

describe('withdrawal', () => {
  describe('createWithdrawalIntent', () => {
    it('creates a withdrawal intent', () => {
      const intent = createWithdrawalIntent({
        positionId: 'pos-1', poolId: 'pool-1', ownerAddress: 'MxLP', amount: 500n,
      });
      expect(intent.status).toBe('requested');
      expect(intent.amount).toBe(500n);
    });

    it('derives a non-replayable, domain-hashed withdrawal ID', () => {
      const a = createWithdrawalIntent({
        positionId: 'pos-1', poolId: 'pool-1', ownerAddress: 'MxLP', amount: 500n, nonce: 'n1',
      });
      const b = createWithdrawalIntent({
        positionId: 'pos-1', poolId: 'pool-1', ownerAddress: 'MxLP', amount: 500n, nonce: 'n1',
      });
      expect(a.withdrawalId).toBe(b.withdrawalId);
      expect(a.withdrawalId).toBe(computeWithdrawalId('pos-1', 'n1'));
      expect(a.withdrawalId).not.toMatch(/^wdrw-/);
      expect(a.withdrawalId).not.toBe(computeWithdrawalId('pos-2', 'n1'));
      expect(a.withdrawalId).not.toBe(computeWithdrawalId('pos-1', 'n2'));
      expect(WITHDRAWAL_ID_DOMAIN).toMatch(/^totemsdk\/liquidity-bond\/withdrawal\/v1$/);
    });
  });

  describe('approveWithdrawalIntent', () => {
    it('approves a withdrawal', () => {
      const intent = createWithdrawalIntent({
        positionId: 'pos-1', poolId: 'pool-1', ownerAddress: 'MxLP', amount: 500n,
      });
      const approved = approveWithdrawalIntent(intent);
      expect(approved.status).toBe('approved');
    });
  });

  describe('rejectWithdrawalIntent', () => {
    it('rejects a withdrawal', () => {
      const intent = createWithdrawalIntent({
        positionId: 'pos-1', poolId: 'pool-1', ownerAddress: 'MxLP', amount: 500n,
      });
      const rejected = rejectWithdrawalIntent(intent, 'insufficient');
      expect(rejected.status).toBe('rejected');
    });
  });

  describe('cancelWithdrawalIntent', () => {
    it('cancels a withdrawal', () => {
      const intent = createWithdrawalIntent({
        positionId: 'pos-1', poolId: 'pool-1', ownerAddress: 'MxLP', amount: 500n,
      });
      const cancelled = cancelWithdrawalIntent(intent);
      expect(cancelled.status).toBe('cancelled');
    });
  });

  describe('verifyWithdrawalAllowed', () => {
    it('allows withdrawal for unlocked position', () => {
      const pool = makePool();
      const pos = makePosition('none');
      const intent = createWithdrawalIntent({
        positionId: pos.positionId, poolId: 'pool-1', ownerAddress: 'MxLP', amount: 500n,
      });
      const result = verifyWithdrawalAllowed({ intent, position: pos, pool, now: 2000 });
      expect(result.ok).toBe(true);
    });

    it('rejects early withdrawal when not allowed', () => {
      const pool = makePool();
      const pos = makePosition('fixed-duration');
      const intent = createWithdrawalIntent({
        positionId: pos.positionId, poolId: 'pool-1', ownerAddress: 'MxLP', amount: 500n,
      });
      const result = verifyWithdrawalAllowed({ intent, position: pos, pool, now: 2000 });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('POSITION_LOCKED');
    });

    it('allows withdrawal after lock period', () => {
      const pool = makePool();
      const pos = makePosition('fixed-duration');
      const intent = createWithdrawalIntent({
        positionId: pos.positionId, poolId: 'pool-1', ownerAddress: 'MxLP', amount: 500n,
      });
      const result = verifyWithdrawalAllowed({ intent, position: pos, pool, now: 20000 });
      expect(result.ok).toBe(true);
    });
  });
});
