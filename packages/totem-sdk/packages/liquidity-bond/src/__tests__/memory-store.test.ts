import { MemoryLiquidityBondStore } from '../memory-store.js';
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

describe('MemoryLiquidityBondStore', () => {
  let store: MemoryLiquidityBondStore;

  beforeEach(() => {
    store = new MemoryLiquidityBondStore();
  });

  it('registers and lists pools', async () => {
    await store.registerPool(makePool('pool-1'));
    const pools = await store.listPools();
    expect(pools).toHaveLength(1);
  });

  it('registers commitments', async () => {
    const c = createLiquidityCommitment({
      poolId: 'pool-1', lpAddress: 'MxLP', asset: 'MINIMA', amount: 1000n,
      purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
    });
    await store.registerCommitment(c);
    const snap = await store.getSnapshot();
    expect(Object.keys(snap.commitments)).toHaveLength(1);
  });

  it('registers positions', async () => {
    const c = createLiquidityCommitment({
      poolId: 'pool-1', lpAddress: 'MxLP', asset: 'MINIMA', amount: 1000n,
      purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
    });
    const pos = createLiquidityPosition({ commitment: c, poolId: 'pool-1' });
    await store.registerPosition(pos);
    const p = await store.getPosition(pos.positionId);
    expect(p).toBeDefined();
  });

  it('attaches receipts', async () => {
    const c = createLiquidityCommitment({
      poolId: 'pool-1', lpAddress: 'MxLP', asset: 'MINIMA', amount: 1000n,
      purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
    });
    const pos = createLiquidityPosition({ commitment: c, poolId: 'pool-1' });
    const receipt = issueLiquidityReceipt({ position: pos, poolId: 'pool-1', ownerAddress: 'MxLP' });
    await store.attachReceipt(receipt);
    const r = await store.getReceipt(receipt.receiptId);
    expect(r).toBeDefined();
  });

  it('attaches allocations', async () => {
    const alloc = createLiquidityAllocation({
      positionId: 'pos-1', poolId: 'pool-1', amount: 500n,
      purpose: 'omnia-router-liquidity', allocationType: 'route-reserve',
    });
    await store.attachAllocation(alloc);
    const snap = await store.getSnapshot();
    expect(snap.allocations['pos-1']).toHaveLength(1);
  });

  it('attaches fee records', async () => {
    const fee = recordLiquidityFee({
      positionId: 'pos-1', poolId: 'pool-1', feeAsset: 'MINIMA',
      grossFeeAmount: 10n, source: 'route-fee',
    });
    await store.attachFeeRecord(fee);
    const snap = await store.getSnapshot();
    expect(snap.feeRecords['pos-1']).toHaveLength(1);
  });

  it('attaches withdrawal intents', async () => {
    const intent = createWithdrawalIntent({
      positionId: 'pos-1', poolId: 'pool-1', ownerAddress: 'MxLP', amount: 500n,
    });
    await store.attachWithdrawalIntent(intent);
    const snap = await store.getSnapshot();
    expect(snap.withdrawals['pos-1']).toHaveLength(1);
  });

  it('lists positions by pool', async () => {
    const c = createLiquidityCommitment({
      poolId: 'pool-1', lpAddress: 'MxLP', asset: 'MINIMA', amount: 1000n,
      purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
    });
    const pos = createLiquidityPosition({ commitment: c, poolId: 'pool-1' });
    await store.registerPosition(pos);
    const positions = await store.listPositionsByPool('pool-1');
    expect(positions).toHaveLength(1);
  });

  it('lists positions by LP', async () => {
    const c = createLiquidityCommitment({
      poolId: 'pool-1', lpAddress: 'MxLP', asset: 'MINIMA', amount: 1000n,
      purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
    });
    const pos = createLiquidityPosition({ commitment: c, poolId: 'pool-1' });
    await store.registerPosition(pos);
    const positions = await store.listPositionsByLp('MxLP');
    expect(positions).toHaveLength(1);
  });

  it('returns cloned snapshots', async () => {
    await store.registerPool(makePool('pool-1'));
    const snap1 = await store.getSnapshot();
    const snap2 = await store.getSnapshot();
    expect(snap1).not.toBe(snap2);
  });
});
