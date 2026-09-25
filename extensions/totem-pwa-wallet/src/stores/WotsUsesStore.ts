/**
 * WotsUsesStore — persistent per-address WOTS `uses` counter for signing paths
 * that are NOT driven by a server lease (message signing / TOTEM_VERIFY).
 *
 * WOTS leaves are one-time keys. Any such path MUST allocate a unique,
 * monotonically changing index so the same leaf is never signed twice across
 * popups/sessions.
 *
 * Allocation is top-down from the tree's maximum index. The transaction path
 * allocates bottom-up from the server-issued `l1/l2` lanes (small indices), so
 * the two allocators do not overlap for any realistic number of signatures.
 *
 * Key: `${rootPublicKey}:${addressIndex}`
 * Value: `nextUses` — the next (descending) index that may be consumed.
 */
import { openDB, type IDBPDatabase } from 'idb';

interface UsesRecord {
  key: string;
  nextUses: number;
  updatedAt: number;
}

const DB_NAME = 'totem-wots-uses';
const DB_VERSION = 1;

let _db: IDBPDatabase | null = null;

async function getDb(): Promise<IDBPDatabase> {
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('wots-uses')) {
        db.createObjectStore('wots-uses', { keyPath: 'key' });
      }
    },
  });
  return _db;
}

export const WotsUsesStore = {
  /**
   * Atomically reserve and return the next message-signing index for `key`,
   * counting DOWN from `maxUses - 1`.
   */
  async reserveFromTop(key: string, maxUses: number): Promise<number> {
    const db = await getDb();
    const tx = db.transaction('wots-uses', 'readwrite');
    const store = tx.objectStore('wots-uses');
    const rec: UsesRecord | undefined = await store.get(key);
    const next = rec ? rec.nextUses : maxUses - 1;
    if (next < 0) {
      throw new Error('WOTS message-signing capacity exhausted for this address');
    }
    await store.put({ key, nextUses: next - 1, updatedAt: Date.now() } satisfies UsesRecord);
    await tx.done;
    return next;
  },

  async clearAll(): Promise<void> {
    const db = await getDb();
    await db.clear('wots-uses');
  },
};
