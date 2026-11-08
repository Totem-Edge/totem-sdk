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

  it('AUD-004: an explicit CAS store coordinates providers with separate file backends', async () => {
    // The host keeps its journal/watermark in JSON files but shares one
    // transactional claim store. Two providers over distinct file directories
    // must still take different leaves.
    const dirs = await Promise.all([
      mkdtemp(join(tmpdir(), 'wots-lease-a-')),
      mkdtemp(join(tmpdir(), 'wots-lease-b-')),
    ]);
    const claims = new Map<string, unknown>();
    const cas = {
      async conditionalUpdate<T>(key: string, update: (current: T | null) => { next: T } | { abort: string }) {
        const decision = update((claims.get(key) as T | undefined) ?? null);
        if ('abort' in decision) return { applied: false, value: null, revision: 0 };
        claims.set(key, decision.next);
        return { applied: true, value: decision.next, revision: 1 };
      },
    };
    try {
      const first = new LocalLeaseProvider(new FileStore(dirs[0]), undefined, 'a', cas);
      const second = new LocalLeaseProvider(new FileStore(dirs[1]), undefined, 'b', cas);
      await Promise.all([first.initialize(), second.initialize()]);
      const [a, b] = await Promise.all([
        first.reserveKeyUse({ treeId: 'shared-tree' }),
        second.reserveKeyUse({ treeId: 'shared-tree' }),
      ]);
      expect(b.indices).not.toEqual(a.indices);
    } finally {
      await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
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
