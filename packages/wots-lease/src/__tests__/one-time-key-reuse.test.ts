import type { StorageAdapter } from '@totemsdk/core';
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
