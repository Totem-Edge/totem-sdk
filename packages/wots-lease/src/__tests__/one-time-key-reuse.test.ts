import type { StorageAdapter } from '@totemsdk/core';
import { FileStore } from '@totemsdk/storage/fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalLeaseProvider } from '../local.js';
import { IndicesUnavailableError } from '../errors.js';

function makeSharedStore(): StorageAdapter {
  const store = new Map<string, unknown>();
  return {
    get: async <T>(key: string) => (store.has(key) ? structuredClone(store.get(key)) as T : null),
    set: async <T>(key: string, value: T) => { store.set(key, structuredClone(value)); },
    remove: async (key: string) => { const had = store.has(key); store.delete(key); return had; },
    clear: async () => { store.clear(); },
    keys: async () => Array.from(store.keys()),
    has: async (key: string) => store.has(key),
  };
}

describe('WOTS one-time-key reuse (AUD-004/005)', () => {
  it('AUD-004: two providers over one storage never allocate the same slot', async () => {
    const store = makeSharedStore();
    const first = new LocalLeaseProvider(store);
    const second = new LocalLeaseProvider(store);
    await first.initialize();
    await second.initialize();

    const a = await first.reserveKeyUse({ treeId: 'same-tree' });
    const b = await second.reserveKeyUse({ treeId: 'same-tree' });
    expect(b.indices).not.toEqual(a.indices);
  });

  it('AUD-004: CAS claim prevents two FileStore-backed providers from claiming one slot', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wots-lease-cas-'));
    try {
      // Two distinct adapter objects over the same durable medium. Without the
      // conditionalUpdate claim both refresh() the same free slot and both write
      // a reservation for it (AUD-004).
      const first = new LocalLeaseProvider(new FileStore(dir));
      const second = new LocalLeaseProvider(new FileStore(dir));
      await Promise.all([first.initialize(), second.initialize()]);

      const indices = { addressIndex: 0, l1: 0, l2: 0 };
      const results = await Promise.allSettled([
        first.reserveSpecificKeyUse({ treeId: 'cas-tree' }, indices),
        second.reserveSpecificKeyUse({ treeId: 'cas-tree' }, indices),
      ]);

      const fulfilled = results.filter((result) => result.status === 'fulfilled');
      const rejected = results.filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(IndicesUnavailableError);

      // The slot is durably claimed: a later attempt still cannot reuse it.
      await expect(
        first.reserveSpecificKeyUse({ treeId: 'cas-tree' }, indices),
      ).rejects.toBeInstanceOf(IndicesUnavailableError);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('AUD-005: rejects a specific reservation below the synchronized watermark cursor', async () => {
    const store = makeSharedStore();
    const provider = new LocalLeaseProvider(store);
    await provider.initialize();
    await provider.advanceToRemoteWatermark('synced', { addressCursor: 0, l1Cursor: 0, l2Cursor: 10 });

    await expect(
      provider.reserveSpecificKeyUse({ treeId: 'synced' }, { addressIndex: 0, l1: 0, l2: 0 }),
    ).rejects.toBeInstanceOf(IndicesUnavailableError);
  });
});
