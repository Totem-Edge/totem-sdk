import {
  createEmptyLiquidityBondRegistryState,
  registerLiquidityPool,
  registerLiquidityCommitment,
  registerLiquidityPosition,
  attachLiquidityReceipt,
  attachLiquidityAllocation,
  attachLiquidityFeeRecord,
  attachWithdrawalIntent,
  getLiquidityPool,
  getLiquidityPosition,
  getLiquidityReceipt,
  listLiquidityPools,
  listPositionsByPool,
  listPositionsByLp,
  listActivePositions,
  listWithdrawablePositions,
} from '../registry.js';
import { createLiquidityPoolManifest } from '../pool-manifest.js';
import { createLiquidityCommitment } from '../commitment.js';
import { createLiquidityPosition } from '../position.js';
import { issueLiquidityReceipt } from '../receipt.js';
import { createLiquidityAllocation } from '../allocation.js';
import { recordLiquidityFee } from '../fees.js';
import { createWithdrawalIntent } from '../withdrawal.js';

function makePool(id = 'pool-1') {
  return createLiquidityPoolManifest({
    poolId: id, poolType: 'omnia-router', purpose: 'omnia-router-liquidity',
    asset: 'MINIMA', lockTerms: { lockType: 'none' }, createdAt: 1000,
  });
}

function makeCommitment(poolId = 'pool-1') {
  return createLiquidityCommitment({
    poolId, lpAddress: 'MxLP', asset: 'MINIMA', amount: 1000n,
    purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
  });
}

function makePosition(poolId = 'pool-1') {
  return createLiquidityPosition({ commitment: makeCommitment(poolId), poolId });
}

describe('registry', () => {
  describe('registerLiquidityPool', () => {
    it('registers a pool', () => {
      let state = createEmptyLiquidityBondRegistryState();
      state = registerLiquidityPool(state, makePool());
      expect(Object.keys(state.pools)).toHaveLength(1);
    });

    it('does not mutate input', () => {
      const state = createEmptyLiquidityBondRegistryState();
      const newState = registerLiquidityPool(state, makePool());
      expect(Object.keys(state.pools)).toHaveLength(0);
      expect(Object.keys(newState.pools)).toHaveLength(1);
    });
  });

  describe('registerLiquidityCommitment', () => {
    it('registers a commitment', () => {
      let state = createEmptyLiquidityBondRegistryState();
      state = registerLiquidityCommitment(state, makeCommitment());
      expect(Object.keys(state.commitments)).toHaveLength(1);
    });
  });

  describe('registerLiquidityPosition', () => {
    it('registers a position', () => {
      let state = createEmptyLiquidityBondRegistryState();
      state = registerLiquidityPosition(state, makePosition());
      expect(Object.keys(state.positions)).toHaveLength(1);
    });
  });

  describe('attachLiquidityReceipt', () => {
    it('attaches a receipt', () => {
      let state = createEmptyLiquidityBondRegistryState();
      const pos = makePosition();
      const receipt = issueLiquidityReceipt({ position: pos, poolId: 'pool-1', ownerAddress: 'MxLP' });
      state = attachLiquidityReceipt(state, receipt);
      expect(Object.keys(state.receipts)).toHaveLength(1);
    });
  });

  describe('attachLiquidityAllocation', () => {
    it('attaches an allocation', () => {
      let state = createEmptyLiquidityBondRegistryState();
      const alloc = createLiquidityAllocation({
        positionId: 'pos-1', poolId: 'pool-1', amount: 500n,
        purpose: 'omnia-router-liquidity', allocationType: 'route-reserve',
      });
      state = attachLiquidityAllocation(state, alloc);
      expect(state.allocations['pos-1']).toHaveLength(1);
    });
  });

  describe('attachLiquidityFeeRecord', () => {
    it('attaches a fee record', () => {
      let state = createEmptyLiquidityBondRegistryState();
      const fee = recordLiquidityFee({
        positionId: 'pos-1', poolId: 'pool-1', feeAsset: 'MINIMA',
        grossFeeAmount: 10n, source: 'route-fee',
      });
      state = attachLiquidityFeeRecord(state, fee);
      expect(state.feeRecords['pos-1']).toHaveLength(1);
    });
  });

  describe('attachWithdrawalIntent', () => {
    it('attaches a withdrawal intent', () => {
      let state = createEmptyLiquidityBondRegistryState();
      const intent = createWithdrawalIntent({
        positionId: 'pos-1', poolId: 'pool-1', ownerAddress: 'MxLP', amount: 500n,
      });
      state = attachWithdrawalIntent(state, intent);
      expect(state.withdrawals['pos-1']).toHaveLength(1);
    });
  });

  describe('getLiquidityPool', () => {
    it('gets a pool by ID', () => {
      let state = createEmptyLiquidityBondRegistryState();
      state = registerLiquidityPool(state, makePool('pool-1'));
      expect(getLiquidityPool(state, 'pool-1')).toBeDefined();
      expect(getLiquidityPool(state, 'pool-2')).toBeUndefined();
    });
  });

  describe('getLiquidityPosition', () => {
    it('gets a position by ID', () => {
      let state = createEmptyLiquidityBondRegistryState();
      const pos = makePosition();
      state = registerLiquidityPosition(state, pos);
      expect(getLiquidityPosition(state, pos.positionId)).toBeDefined();
    });
  });

  describe('getLiquidityReceipt', () => {
    it('gets a receipt by ID', () => {
      let state = createEmptyLiquidityBondRegistryState();
      const pos = makePosition();
      const receipt = issueLiquidityReceipt({ position: pos, poolId: 'pool-1', ownerAddress: 'MxLP' });
      state = attachLiquidityReceipt(state, receipt);
      expect(getLiquidityReceipt(state, receipt.receiptId)).toBeDefined();
    });
  });

  describe('listLiquidityPools', () => {
    it('lists all pools', () => {
      let state = createEmptyLiquidityBondRegistryState();
      state = registerLiquidityPool(state, makePool('pool-1'));
      state = registerLiquidityPool(state, makePool('pool-2'));
      expect(listLiquidityPools(state)).toHaveLength(2);
    });
  });

  describe('listPositionsByPool', () => {
    it('lists positions by pool', () => {
      let state = createEmptyLiquidityBondRegistryState();
      state = registerLiquidityPosition(state, makePosition('pool-1'));
      state = registerLiquidityPosition(state, makePosition('pool-2'));
      expect(listPositionsByPool(state, 'pool-1')).toHaveLength(1);
    });
  });

  describe('listPositionsByLp', () => {
    it('lists positions by LP', () => {
      let state = createEmptyLiquidityBondRegistryState();
      state = registerLiquidityPosition(state, makePosition());
      expect(listPositionsByLp(state, 'MxLP')).toHaveLength(1);
      expect(listPositionsByLp(state, 'MxOther')).toHaveLength(0);
    });
  });

  describe('listActivePositions', () => {
    it('lists active positions', () => {
      let state = createEmptyLiquidityBondRegistryState();
      state = registerLiquidityPosition(state, makePosition());
      expect(listActivePositions(state)).toHaveLength(1);
    });
  });

  describe('listWithdrawablePositions', () => {
    it('lists withdrawable positions', () => {
      let state = createEmptyLiquidityBondRegistryState();
      state = registerLiquidityPosition(state, makePosition());
      const withdrawable = listWithdrawablePositions(state, Date.now());
      expect(withdrawable).toHaveLength(1);
    });
  });
});
