import type { StorageAdapter } from '@totemsdk/core';
import { codec } from '@totemsdk/storage/codec';
import { LocalLeaseProvider } from '../local.js';
import type { SigningIndices } from '../types.js';

const WATERMARK_KEY = 'totem_wots_watermark';
const LEASES_KEY = 'totem_wots_leases';

class DurableTestStore implements StorageAdapter {
  private readonly values = new Map<string, Uint8Array>();
  private failKey: string | null = null;

  failOnce(key: string): void {
    this.failKey = key;
  }

  async get<T>(key: string): Promise<T | null> {
    const value = this.values.get(key);
    return value ? (codec.deserialize(value) as T) : null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (this.failKey === key) {
      this.failKey = null;
      throw new Error(`injected failure for ${key}`);
    }
    this.values.set(key, codec.serialize(value));
  }

  async remove(key: string): Promise<boolean> {
    return this.values.delete(key);
  }

  async clear(): Promise<void> {
    this.values.clear();
  }

  async keys(): Promise<string[]> {
    return [...this.values.keys()];
  }

  async has(key: string): Promise<boolean> {
    return this.values.has(key);
  }
}

describe('LocalLeaseProvider reservation recovery', () => {
  it('never re-exposes an index after journal ack but watermark write failure', async () => {
    const store = new DurableTestStore();
    const first = new LocalLeaseProvider(store);
    await first.initialize();

    store.failOnce(WATERMARK_KEY);
    await expect(first.reserveKeyUse({ treeId: 'tree-a' })).rejects.toThrow('injected failure');

    const reopened = new LocalLeaseProvider(store);
    await reopened.initialize();
    const orphan = reopened.getJournal().getAll()[0];
    expect(reopened.getJournal().getByReservation(orphan.reservationId!)?.status).toBe('burned');
    const next = await reopened.reserveKeyUse({ treeId: 'tree-a' });
    expect(next.indices).toEqual({ addressIndex: 0, l1: 0, l2: 1 });
  });

  it('rebuilds no-reuse state when mutable watermark and lease snapshots are lost', async () => {
    const store = new DurableTestStore();
    const first = new LocalLeaseProvider(store);
    const reserved = await first.reserveKeyUse({ treeId: 'tree-a' });
    expect(reserved.indices).toEqual({ addressIndex: 0, l1: 0, l2: 0 });

    await store.remove(WATERMARK_KEY);
    await store.remove(LEASES_KEY);

    const reopened = new LocalLeaseProvider(store);
    await reopened.initialize();
    expect(reopened.getJournal().getByReservation(reserved.reservationId)?.status).toBe('burned');
    const next = await reopened.reserveKeyUse({ treeId: 'tree-a' });
    expect(next.indices).toEqual({ addressIndex: 0, l1: 0, l2: 1 });
  });

  it('rejects explicit indices below an advanced watermark cursor', async () => {
    const store = new DurableTestStore();
    const provider = new LocalLeaseProvider(store);
    await provider.initialize();
    await provider.advanceToRemoteWatermark('tree-a', {
      addressCursor: 0,
      l1Cursor: 0,
      l2Cursor: 10,
    });

    await expect(provider.reserveSpecificKeyUse(
      { treeId: 'tree-a' },
      { addressIndex: 0, l1: 0, l2: 5 },
    )).rejects.toThrow('unavailable');
  });

  it('serializes concurrent reservations so every index is unique', async () => {
    const provider = new LocalLeaseProvider(new DurableTestStore());
    const reservations = await Promise.all(
      Array.from({ length: 16 }, () => provider.reserveKeyUse({ treeId: 'tree-a' })),
    );

    expect(new Set(reservations.map(({ indices }) => JSON.stringify(indices))).size).toBe(16);
    expect(reservations.map(({ indices }) => indices.l2)).toEqual([...Array(16).keys()]);
  });

  it('makes duplicate commits idempotent and rejects a conflicting burn', async () => {
    const provider = new LocalLeaseProvider(new DurableTestStore());
    const reservation = await provider.reserveKeyUse({ treeId: 'tree-a' });

    await Promise.all([
      provider.commitKeyUse(reservation.reservationId, 'tx-1'),
      provider.commitKeyUse(reservation.reservationId, 'tx-1'),
    ]);
    expect(provider.getJournal().getAll().filter(
      (entry) => entry.reservationId === reservation.reservationId && entry.status === 'committed',
    )).toHaveLength(1);
    await expect(provider.burnReservation(reservation.reservationId, 'too late')).rejects.toThrow(
      'Cannot transition lease',
    );
  });

  it('rejects a commit retry with a different transaction id', async () => {
    const provider = new LocalLeaseProvider(new DurableTestStore());
    const reservation = await provider.reserveKeyUse({ treeId: 'tree-a' });

    await provider.commitKeyUse(reservation.reservationId, 'tx-1');
    await expect(provider.commitKeyUse(reservation.reservationId, 'tx-2')).rejects.toThrow(
      'Cannot transition lease',
    );
    expect(provider.getJournal().getByReservation(reservation.reservationId)).toMatchObject({
      status: 'committed',
      txId: 'tx-1',
    });
  });

  it('serializes commit against burn so only one terminal state wins', async () => {
    const provider = new LocalLeaseProvider(new DurableTestStore());
    const reservation = await provider.reserveKeyUse({ treeId: 'tree-a' });

    const commit = provider.commitKeyUse(reservation.reservationId, 'tx-1');
    const burn = provider.burnReservation(reservation.reservationId, 'raced');
    await expect(commit).resolves.toBeUndefined();
    await expect(burn).rejects.toThrow('Cannot transition lease');
    const terminal = provider.getJournal().getAll().filter(
      (entry) => entry.reservationId === reservation.reservationId && entry.status !== 'reserved',
    );
    expect(terminal.map((entry) => entry.status)).toEqual(['committed']);
  });

  it.each([
    { addressIndex: -1, l1: 0, l2: 0 },
    { addressIndex: 0, l1: 0.5, l2: 0 },
    { addressIndex: 0, l1: 0, l2: 64 },
  ])('rejects invalid explicit indices: %j', async (indices) => {
    const provider = new LocalLeaseProvider(new DurableTestStore());
    await expect(provider.reserveSpecificKeyUse({ treeId: 'tree-a' }, indices)).rejects.toThrow(
      'must be an integer',
    );
  });

  it('rejects indices with a missing component', async () => {
    const provider = new LocalLeaseProvider(new DurableTestStore());
    const incomplete = { addressIndex: 0, l1: 0 } as SigningIndices;
    await expect(provider.reserveSpecificKeyUse({ treeId: 'tree-a' }, incomplete)).rejects.toThrow(
      'WOTS l2 must be an integer',
    );
  });

  it('rejects an invalid remote watermark without persisting it', async () => {
    const provider = new LocalLeaseProvider(new DurableTestStore());
    await provider.initialize();

    await expect(provider.advanceToRemoteWatermark('tree-a', {
      addressCursor: 64,
      l1Cursor: 0,
      l2Cursor: 0,
    })).rejects.toThrow('must be an integer');
    expect(await provider.getLocalWatermark('tree-a')).toMatchObject({
      addressCursor: 0,
      l1Cursor: 0,
      l2Cursor: 0,
    });
  });

  it('retries a failed reconciliation status write durably', async () => {
    const store = new DurableTestStore();
    const first = new LocalLeaseProvider(store);
    const reservation = await first.reserveKeyUse({ treeId: 'tree-a' });
    const reserved = first.getJournal().getByReservation(reservation.reservationId)!;
    await first.getJournal().append({
      ...reserved,
      status: 'committed',
      txId: 'tx-1',
      timestamp: Date.now(),
    });

    const reopened = new LocalLeaseProvider(store);
    store.failOnce(LEASES_KEY);
    await expect(reopened.initialize()).rejects.toThrow('injected failure');
    await reopened.initialize();

    const leases = await store.get<Array<{ leaseId: string; status: string }>>(LEASES_KEY);
    expect(leases?.find((lease) => lease.leaseId === reservation.reservationId)?.status).toBe('finalized');
  });
});
