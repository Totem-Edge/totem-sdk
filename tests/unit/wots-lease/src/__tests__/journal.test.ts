import type { StorageAdapter } from '@totemsdk/core';
import { codec } from '@totemsdk/storage/codec';
import { FileStore } from '@totemsdk/storage/fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LeaseJournal } from '../journal.js';
import type { JournalEntry } from '../types.js';

const ENTRY_PREFIX = 'totem_wots_journal:v1:entry:';
const LEGACY_KEY = 'totem_wots_journal';

class RecordingStore implements StorageAdapter {
  readonly writes: string[] = [];
  failNextWrite = false;
  private readonly values = new Map<string, Uint8Array>();

  async get<T>(key: string): Promise<T | null> {
    const value = this.values.get(key);
    return value ? (codec.deserialize(value) as T) : null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error('injected write failure');
    }
    this.values.set(key, codec.serialize(value));
    this.writes.push(key);
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

function entry(index: number, status: JournalEntry['status'] = 'reserved'): JournalEntry {
  return {
    treeId: 'tree-a',
    branchId: 'main',
    wotsIndex: index,
    indices: { addressIndex: 0, l1: 0, l2: index },
    status,
    reservationId: `r${index}`,
    timestamp: 1000 + index,
    deviceId: 'device-0',
  };
}

describe('LeaseJournal physical append-only layout', () => {
  it('writes immutable per-sequence records and preserves the SHA-256 format', async () => {
    const store = new RecordingStore();
    const journal = new LeaseJournal(store);
    await journal.initialize();
    await journal.append(entry(0));
    await journal.append(entry(1));

    const entries = journal.getAll();
    expect(entries).toHaveLength(2);
    expect(entries[0].hash).toBe('f49385ff28dc2e53acf54628985ed4d493b1937c8404f8b97a5d88e45aa683fb');
    expect(entries[1].previousHash).toBe(entries[0].hash);

    const keys = (await store.keys()).filter((key) => key.startsWith(ENTRY_PREFIX));
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(2);
    expect(store.writes.filter((key) => key === keys[0])).toHaveLength(1);
    expect(await store.has(LEGACY_KEY)).toBe(false);
  });

  it('does not contaminate memory or consume a sequence when a write fails', async () => {
    const store = new RecordingStore();
    const journal = new LeaseJournal(store);
    await journal.initialize();
    await journal.append(entry(0));

    store.failNextWrite = true;
    await expect(journal.append(entry(1))).rejects.toThrow('injected write failure');
    expect(journal.getAll()).toHaveLength(1);

    await journal.append(entry(1));
    expect(journal.getAll()).toHaveLength(2);
    expect((await store.keys()).filter((key) => key.startsWith(ENTRY_PREFIX))).toHaveLength(2);
  });

  it('serializes appends from journal instances sharing a store', async () => {
    const store = new RecordingStore();
    const first = new LeaseJournal(store);
    const second = new LeaseJournal(store);
    await Promise.all([first.initialize(), second.initialize()]);

    await Promise.all([first.append(entry(0)), second.append(entry(1))]);

    const reopened = new LeaseJournal(store);
    await reopened.initialize();
    expect(reopened.getAll()).toHaveLength(2);
  });

  it('reopens a durable file store and verifies the chain', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wots-journal-'));
    try {
      const first = new LeaseJournal(new FileStore(dir));
      await first.initialize();
      await first.append(entry(0));
      await first.append(entry(1, 'committed'));

      const reopened = new LeaseJournal(new FileStore(dir));
      await reopened.initialize();
      expect(reopened.getAll()).toEqual(first.getAll());
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('migrates a legacy array and resumes an interrupted migration', async () => {
    const seedStore = new RecordingStore();
    const seed = new LeaseJournal(seedStore);
    await seed.initialize();
    await seed.append(entry(0));
    await seed.append(entry(1, 'committed'));
    const legacy = seed.getAll();

    const store = new RecordingStore();
    await store.set(LEGACY_KEY, legacy);
    const migrated = new LeaseJournal(store);
    await migrated.initialize();
    expect(migrated.getAll()).toEqual(legacy);
    expect((await store.keys()).filter((key) => key.startsWith(ENTRY_PREFIX))).toHaveLength(2);
    expect(await store.has(LEGACY_KEY)).toBe(true);

    const physical = (await store.keys()).filter((key) => key.startsWith(ENTRY_PREFIX)).sort();
    await store.remove(physical[1]);
    const resumed = new LeaseJournal(store);
    await resumed.initialize();
    expect(resumed.getAll()).toEqual(legacy);
    expect((await store.keys()).filter((key) => key.startsWith(ENTRY_PREFIX))).toHaveLength(2);
  });

  it('rejects tampering, sequence gaps, and forks', async () => {
    const tamperedStore = new RecordingStore();
    const journal = new LeaseJournal(tamperedStore);
    await journal.initialize();
    await journal.append(entry(0));
    const [key] = (await tamperedStore.keys()).filter((candidate) => candidate.startsWith(ENTRY_PREFIX));
    const record = await tamperedStore.get<Record<string, unknown>>(key);
    await tamperedStore.set(key, {
      ...record,
      entry: { ...(record?.entry as Record<string, unknown>), status: 'burned' },
    });
    await expect(new LeaseJournal(tamperedStore).initialize()).rejects.toMatchObject({ code: 'corrupt' });

    const indexStore = new RecordingStore();
    const withIndexTampering = new LeaseJournal(indexStore);
    await withIndexTampering.initialize();
    await withIndexTampering.append(entry(0));
    const [indexKey] = (await indexStore.keys()).filter((candidate) => candidate.startsWith(ENTRY_PREFIX));
    const indexRecord = await indexStore.get<Record<string, unknown>>(indexKey);
    await indexStore.set(indexKey, {
      ...indexRecord,
      entry: {
        ...(indexRecord?.entry as Record<string, unknown>),
        indices: { addressIndex: 0, l1: 0, l2: 1 },
      },
    });
    await expect(new LeaseJournal(indexStore).initialize()).rejects.toMatchObject({ code: 'corrupt' });

    const gapStore = new RecordingStore();
    const withGap = new LeaseJournal(gapStore);
    await withGap.initialize();
    await withGap.append(entry(0));
    await withGap.append(entry(1));
    const gapKeys = (await gapStore.keys()).filter((candidate) => candidate.startsWith(ENTRY_PREFIX)).sort();
    await gapStore.remove(gapKeys[0]);
    await expect(new LeaseJournal(gapStore).initialize()).rejects.toMatchObject({ code: 'corrupt' });

    const forkStore = new RecordingStore();
    const forked = new LeaseJournal(forkStore);
    await forked.initialize();
    await forked.append(entry(0));
    const [original] = (await forkStore.keys()).filter((candidate) => candidate.startsWith(ENTRY_PREFIX));
    const originalRecord = await forkStore.get(original);
    await forkStore.set(`${ENTRY_PREFIX}0000000000000000:${'0'.repeat(64)}`, originalRecord);
    await expect(new LeaseJournal(forkStore).initialize()).rejects.toMatchObject({ code: 'corrupt' });
  });

  it('returns defensive copies and refuses destructive clear', async () => {
    const store = new RecordingStore();
    const journal = new LeaseJournal(store);
    await journal.initialize();
    await journal.append(entry(0));

    const read = journal.getAll();
    read[0].status = 'burned';
    read[0].indices.l2 = 99;
    expect(journal.getAll()[0]).toMatchObject({ status: 'reserved', indices: { l2: 0 } });
    await expect(journal.clear()).rejects.toMatchObject({ code: 'write-failed' });
  });

  it('rejects mismatched and out-of-range index representations', async () => {
    const journal = new LeaseJournal(new RecordingStore());
    await journal.initialize();

    await expect(journal.append({
      ...entry(0),
      indices: { addressIndex: 0, l1: 0, l2: 1 },
    })).rejects.toMatchObject({ code: 'corrupt' });
    await expect(journal.append({
      ...entry(0),
      wotsIndex: 64,
      indices: { addressIndex: 0, l1: 0, l2: 64 },
    })).rejects.toMatchObject({ code: 'corrupt' });
  });
});
