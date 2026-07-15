import {
  createLiquidityAllocation,
  releaseLiquidityAllocation,
  markAllocationDepleted,
  verifyLiquidityAllocation,
  sumActiveAllocations,
} from '../allocation.js';
import { createLiquidityPosition } from '../position.js';
import { createLiquidityCommitment } from '../commitment.js';

function makePosition(amount = 1000n) {
  const commitment = createLiquidityCommitment({
    poolId: 'pool-1', lpAddress: 'MxLP', asset: 'MINIMA', amount,
    purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
  });
  return createLiquidityPosition({ commitment, poolId: 'pool-1' });
}

describe('allocation', () => {
  describe('createLiquidityAllocation', () => {
    it('creates an allocation', () => {
      const alloc = createLiquidityAllocation({
        positionId: 'pos-1', poolId: 'pool-1', amount: 500n,
        purpose: 'omnia-router-liquidity', allocationType: 'route-reserve',
      });
      expect(alloc.status).toBe('active');
      expect(alloc.amount).toBe(500n);
    });
  });

  describe('sumActiveAllocations', () => {
    it('sums active allocations', () => {
      const a1 = createLiquidityAllocation({
        positionId: 'pos-1', poolId: 'pool-1', amount: 100n,
        purpose: 'omnia-router-liquidity', allocationType: 'route-reserve',
      });
      const a2 = createLiquidityAllocation({
        positionId: 'pos-1', poolId: 'pool-1', amount: 200n,
        purpose: 'omnia-router-liquidity', allocationType: 'channel-capital',
      });
      const released = releaseLiquidityAllocation(a2);
      expect(sumActiveAllocations([a1, released])).toBe(100n);
    });
  });

  describe('verifyLiquidityAllocation', () => {
    it('verifies a valid allocation', () => {
      const pos = makePosition();
      const alloc = createLiquidityAllocation({
        positionId: pos.positionId, poolId: 'pool-1', amount: 500n,
        purpose: 'omnia-router-liquidity', allocationType: 'route-reserve',
      });
      const result = verifyLiquidityAllocation({ allocation: alloc, position: pos });
      expect(result.ok).toBe(true);
    });

    it('rejects allocation exceeding position', () => {
      const pos = makePosition(500n);
      const alloc = createLiquidityAllocation({
        positionId: pos.positionId, poolId: 'pool-1', amount: 1000n,
        purpose: 'omnia-router-liquidity', allocationType: 'route-reserve',
      });
      const result = verifyLiquidityAllocation({ allocation: alloc, position: pos });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('ALLOCATION_EXCEEDS_POSITION');
    });
  });

  describe('releaseLiquidityAllocation', () => {
    it('releases an allocation', () => {
      const alloc = createLiquidityAllocation({
        positionId: 'pos-1', poolId: 'pool-1', amount: 500n,
        purpose: 'omnia-router-liquidity', allocationType: 'route-reserve',
      });
      const released = releaseLiquidityAllocation(alloc);
      expect(released.status).toBe('released');
    });
  });

  describe('markAllocationDepleted', () => {
    it('marks allocation depleted', () => {
      const alloc = createLiquidityAllocation({
        positionId: 'pos-1', poolId: 'pool-1', amount: 500n,
        purpose: 'omnia-router-liquidity', allocationType: 'route-reserve',
      });
      const depleted = markAllocationDepleted(alloc);
      expect(depleted.status).toBe('depleted');
    });
  });
});
