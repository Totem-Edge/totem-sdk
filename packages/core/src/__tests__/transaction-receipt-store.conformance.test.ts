/**
 * TransactionReceiptStore persistence-consumer conformance (RFC-007 Phase 4).
 *
 * Proves receipt recovery guarantees over a strict, disk-backed StorageAdapter:
 * - receipts survive a simulated restart;
 * - a corrupt receipt record is surfaced (fail-closed);
 * - every mutator rolls back its in-memory state when a write fails.
 */

import { NoopLogger } from '../adapters/index.js';
import { DurableTestStorage, createTempDir } from '../../test/helpers/durable-test-storage.js';
import type { TransactionReceipt } from '../tx/types.js';
import { TransactionReceiptStore } from '../tx/TransactionReceiptStore.js';

const DEFAULT_KEY = 'totem_transaction_receipts';

function makeReceipt(txpowid: string, status: TransactionReceipt['status'] = 'confirmed'): TransactionReceipt {
  return {
    txpowid,
    timestamp: Date.now(),
    to: '0xrecipient',
    amount: '100',
    tokenId: '0x00',
    indices: { addressIndex: 0, l1: 0, l2: 0 },
    status,
    txId: `tx-${txpowid}`,
    leaseId: `lease-${txpowid}`,
  };
}

describe('TransactionReceiptStore — durability conformance', () => {
  let dir: string;
  let storage: DurableTestStorage;

  beforeEach(async () => {
    dir = await createTempDir();
    storage = new DurableTestStorage(dir);
  });

  afterEach(async () => {
    await storage.clear().catch(() => undefined);
  });

  it('preserves receipts across a simulated restart', async () => {
    const first = new TransactionReceiptStore(storage);
    await first.initialize();
    await first.add(makeReceipt('0xaaaa'));
    await first.add(makeReceipt('0xbbbb', 'pending'));

    const second = new TransactionReceiptStore(new DurableTestStorage(dir));
    await second.initialize();

    expect(second.count()).toBe(2);
    expect(second.getByTxpowid('0xaaaa')?.status).toBe('confirmed');
    expect(second.getByTxpowid('0xbbbb')?.status).toBe('pending');
  });

  it('preserves status updates across a restart', async () => {
    const first = new TransactionReceiptStore(storage);
    await first.initialize();
    await first.add(makeReceipt('0xcccc', 'pending'));
    await first.updateStatus('0xcccc', 'confirmed');

    const second = new TransactionReceiptStore(new DurableTestStorage(dir));
    await second.initialize();
    expect(second.getByTxpowid('0xcccc')?.status).toBe('confirmed');
  });

  it('surfaces a corrupt receipt record instead of silently dropping history', async () => {
    const first = new TransactionReceiptStore(storage);
    await first.initialize();
    await first.add(makeReceipt('0xdddd'));

    await storage.corrupt(DEFAULT_KEY);

    const second = new TransactionReceiptStore(new DurableTestStorage(dir));
    await expect(second.initialize()).rejects.toThrow(/corrupt/);
    expect(second.isInitialized()).toBe(false);
  });

  it('rolls back memory when add fails to persist', async () => {
    const first = new TransactionReceiptStore(storage);
    await first.initialize();
    await first.add(makeReceipt('0xexisting'));

    storage.failNextSet();
    await expect(first.add(makeReceipt('0xphantom'))).rejects.toThrow(/injected/);
    expect(first.count()).toBe(1);
    expect(first.getByTxpowid('0xphantom')).toBeUndefined();

    storage.repairSets();
    await first.add(makeReceipt('0xphantom'));
    expect(first.count()).toBe(2);
  });

  it('rolls back memory when updateStatus fails to persist', async () => {
    const first = new TransactionReceiptStore(storage);
    await first.initialize();
    await first.add(makeReceipt('0xstatus', 'pending'));

    storage.failNextSet();
    await expect(first.updateStatus('0xstatus', 'confirmed')).rejects.toThrow(/injected/);
    expect(first.getByTxpowid('0xstatus')?.status).toBe('pending');
  });

  it('rolls back memory when clear fails to remove', async () => {
    const first = new TransactionReceiptStore(storage);
    await first.initialize();
    await first.add(makeReceipt('0xpersist'));

    storage.failNextRemove();
    await expect(first.clear()).rejects.toThrow(/injected/);
    expect(first.count()).toBe(1);

    storage.repairAll();
    await first.clear();
    expect(first.count()).toBe(0);
  });

  it('trims to maxReceipts and preserves the trim across restarts', async () => {
    const first = new TransactionReceiptStore(storage, new NoopLogger(), {
      maxReceipts: 2,
    });
    await first.initialize();
    await first.add(makeReceipt('0xoldest'));
    await first.add(makeReceipt('0xmiddle'));
    await first.add(makeReceipt('0xnewest'));

    expect(first.count()).toBe(2);
    expect(first.getByTxpowid('0xoldest')).toBeUndefined();
    expect(first.getByTxpowid('0xnewest')).toBeDefined();

    const second = new TransactionReceiptStore(new DurableTestStorage(dir), new NoopLogger(), {
      maxReceipts: 2,
    });
    await second.initialize();
    expect(second.count()).toBe(2);
  });
});