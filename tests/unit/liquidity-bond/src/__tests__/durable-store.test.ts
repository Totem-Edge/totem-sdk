/**
 * Durable liquidity-bond/claim registry tests (RFC-007 G6).
 *
 * Drop-in parity with `MemoryLiquidityBondStore`, plus the Phase 3 gates:
 * reopen survival, concurrent transition safety (revision-CAS), corrupt
 * records surfaced (never treated as absence), and no-silent-downgrade.
 */

import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { MemoryStore } from '@totemsdk/storage';
import { FileStore } from '@totemsdk/storage/fs';
import { StorageError } from '@totemsdk/storage/errors';
import { createDurableLiquidityBondStore } from '../durable-store.js';
import { createLiquidityPoolManifest } from '../pool-manifest.js';
import { createLiquidityCommitment } from '../commitment.js';
import { createLiquidityPosition } from '../position.js';
import { issueLiquidityReceipt } from '../receipt.js';
import { createLiquidityAllocation } from '../allocation.js';
import { recordLiquidityFee } from '../fees.js';
import { createWithdrawalIntent } from '../withdrawal.js';
import type { LiquidityCommitment } from '../types.js';

const VOLATILE = { requireAckMode: 'volatile' as const };

function makePool(id = 'pool-1') {
  return createLiquidityPoolManifest({
    poolId: id, poolType: 'omnia-router', purpose: 'omnia-router-liquidity',
    asset: 'MINIMA', lockTerms: { lockType: 'none' }, createdAt: 1000,
  });
}

function makeCommitment(commitmentId = 'c-1'): LiquidityCommitment {
  return createLiquidityCommitment({
    poolId: 'pool-1', lpAddress: 'MxLP', asset: 'MINIMA', amount: 1000n,
    purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
  });
}

describe('createDurableLiquidityBondStore', () => {
  describe('MemoryStore (volatile) — drop-in parity with MemoryLiquidityBondStore', () => {
    let store: ReturnType<typeof createDurableLiquidityBondStore>;

    beforeEach(() => {
      store = createDurableLiquidityBondStore(new MemoryStore(), VOLATILE);
    });

    it('registers and lists pools', async () => {
      await store.registerPool(makePool('pool-1'));
      expect(await store.listPools()).toHaveLength(1);
    });

    it('registers commitments and positions', async () => {
      const commitment = makeCommitment();
      await store.registerCommitment(commitment);
      const position = createLiquidityPosition({ commitment, poolId: 'pool-1' });
      await store.registerPosition(position);
      expect(await store.getPosition(position.positionId)).toBeDefined();
    });

    it('attaches receipts, allocations, fee records and withdrawals', async () => {
      const commitment = makeCommitment();
      const position = createLiquidityPosition({ commitment, poolId: 'pool-1' });
      const receipt = issueLiquidityReceipt({ position, poolId: 'pool-1', ownerAddress: 'MxLP' });
      await store.attachReceipt(receipt);
      await store.attachAllocation(createLiquidityAllocation({
        positionId: 'pos-1', poolId: 'pool-1', amount: 500n,
        purpose: 'omnia-router-liquidity', allocationType: 'route-reserve',
      }));
      await store.attachFeeRecord(recordLiquidityFee({
        positionId: 'pos-1', poolId: 'pool-1', feeAsset: 'MINIMA',
        grossFeeAmount: 10n, source: 'route-fee', earnProof: { htlcId: 'h-1' },
      }));
      await store.attachWithdrawalIntent(createWithdrawalIntent({
        positionId: 'pos-1', poolId: 'pool-1', ownerAddress: 'MxLP', amount: 500n,
      }));
      const snapshot = await store.getSnapshot();
      expect(await store.getReceipt(receipt.receiptId)).toBeDefined();
      expect(snapshot.allocations['pos-1']).toHaveLength(1);
      expect(snapshot.feeRecords['pos-1']).toHaveLength(1);
      expect(snapshot.withdrawals['pos-1']).toHaveLength(1);
    });

    it('lists positions by pool and by LP', async () => {
      const commitment = makeCommitment();
      const position = createLiquidityPosition({ commitment, poolId: 'pool-1' });
      await store.registerPosition(position);
      expect(await store.listPositionsByPool('pool-1')).toHaveLength(1);
      expect(await store.listPositionsByLp('MxLP')).toHaveLength(1);
    });

    it('lists active and withdrawable positions', async () => {
      const commitment = makeCommitment();
      const position = createLiquidityPosition({ commitment, poolId: 'pool-1' });
      await store.registerPosition(position);
      expect(await store.listActivePositions()).toHaveLength(1);
      expect(await store.listWithdrawablePositions(0)).toHaveLength(1);
    });

    it('returns cloned snapshots', async () => {
      await store.registerPool(makePool('pool-1'));
      const snap1 = await store.getSnapshot();
      const snap2 = await store.getSnapshot();
      expect(snap1).not.toBe(snap2);
    });

    it('survives a full store restart over the same adapter (reopen)', async () => {
      const adapter = new MemoryStore();
      const first = createDurableLiquidityBondStore(adapter, VOLATILE);
      const commitment = makeCommitment();
      await first.registerPool(makePool('pool-1'));
      await first.registerCommitment(commitment);
      const position = createLiquidityPosition({ commitment, poolId: 'pool-1' });
      await first.registerPosition(position);

      const reopened = createDurableLiquidityBondStore(adapter, VOLATILE);
      expect((await reopened.listPools())).toHaveLength(1);
      expect(await reopened.getPosition(position.positionId)).toBeDefined();
      expect(await reopened.getRevision()).toBe(3);
      expect(await reopened.hasState()).toBe(true);
    });

    it('keeps bigint-typed amounts as bigint through the store', async () => {
      const adapter = new MemoryStore();
      const first = createDurableLiquidityBondStore(adapter, VOLATILE);
      const commitment = makeCommitment();
      await first.registerCommitment(commitment);

      const raw = await adapter.get<{ state: { commitments: Record<string, { amount: bigint }> } }>('totem_liquidity_bond:v1:snapshot');
      expect(raw?.state.commitments[commitment.commitmentId].amount).toBe(1000n);
    });

    it('serializes concurrent registrations without a lost update (revision-CAS)', async () => {
      const store = createDurableLiquidityBondStore(new MemoryStore(), VOLATILE);
      await Promise.all(
        Array.from({ length: 20 }, (_, i) => store.registerPool(makePool(`pool-${i}`))),
      );
      expect(await store.listPools()).toHaveLength(20);
    });
  });

  describe('FileStore (durably-acknowledged) — durable close/reopen', () => {
    let dir: string;

    beforeEach(async () => {
      dir = await fs.mkdtemp(join(tmpdir(), 'totem-lb-bond-'));
    });

    afterEach(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });

    it('does not fail-open on a corrupt registry record (strict)', async () => {
      const adapter = new FileStore(dir);
      const store = createDurableLiquidityBondStore(adapter);
      await store.registerPool(makePool('pool-1'));
      await store.registerCommitment(makeCommitment());

      await adapter.set('totem_liquidity_bond:v1:snapshot', { shredded: true });

      await expect(store.getPool('pool-1')).rejects.toMatchObject({ code: 'corrupt' });
      expect(await store.hasState()).toBe(true);
    });

    it('reopens on-disk state after a brand-new store instance (registry reopen gate)', async () => {
      const adapter1 = new FileStore(dir);
      const first = createDurableLiquidityBondStore(adapter1);
      const commitment = makeCommitment();
      await first.registerPool(makePool('pool-1'));
      await first.registerCommitment(commitment);
      await first.registerPosition(createLiquidityPosition({ commitment, poolId: 'pool-1' }));

      const adapter2 = new FileStore(dir);
      const reopened = createDurableLiquidityBondStore(adapter2);
      const snapshot = await reopened.getSnapshot();
      expect(snapshot.pools['pool-1']).toBeDefined();
      expect(snapshot.commitments[commitment.commitmentId].amount).toBe('1000');
      expect(Object.keys(snapshot.positions)).toHaveLength(1);
    });

    it('throws StorageError on tampered on-disk bytes', async () => {
      const adapter = new FileStore(dir);
      const store = createDurableLiquidityBondStore(adapter);
      await store.registerPool(makePool('pool-1'));

      for (const file of await fs.readdir(dir)) {
        if (file.startsWith('.tmp')) continue;
        await fs.writeFile(join(dir, file), Buffer.from('TAMPERED'));
      }
      await expect(store.listPools()).rejects.toThrow(StorageError);
    });
  });

  it('rejects a volatile adapter under the durable default (no silent downgrade)', () => {
    expect(() => createDurableLiquidityBondStore(new MemoryStore())).toThrow(
      /acknowledges "volatile" but consumer requires "durably-acknowledged"/,
    );
  });
});