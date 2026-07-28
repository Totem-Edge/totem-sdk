/**
 * SigCacheStore — IndexedDB port of ParentChildSigCache
 *
 * Original: packages/totem-extension/src/core/stores/ParentChildSigCache.ts
 * Change: chrome.storage.local → IndexedDB ('sig-cache' store)
 *
 * Purpose: caches WOTS parent→child precomputed signature tables so repeat
 * signing is fast (avoids 30-40s full recompute per send).
 *
 * Schema: 'sig-cache' store keyed by walletId (SHA3-256 of rootPublicKey hex)
 */
import { openDB, type IDBPDatabase } from 'idb';

export interface SigCacheEntry {
  walletId: string;
  data: unknown;
  updatedAt: number;
}

const SC_DB_NAME = 'totem-sig-cache';
const SC_DB_VERSION = 1;

let _db: IDBPDatabase | null = null;

async function getDb(): Promise<IDBPDatabase> {
  if (_db) return _db;
  _db = await openDB(SC_DB_NAME, SC_DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('sig-cache')) {
        db.createObjectStore('sig-cache', { keyPath: 'walletId' });
      }
    },
  });
  return _db;
}

export const SigCacheStore = {
  async getCacheForWallet(walletId: string): Promise<unknown | null> {
    const db = await getDb();
    const rec: SigCacheEntry | undefined = await db.get('sig-cache', walletId);
    return rec?.data ?? null;
  },

  async saveCacheForWallet(walletId: string, data: unknown): Promise<void> {
    const db = await getDb();
    await db.put('sig-cache', { walletId, data, updatedAt: Date.now() } satisfies SigCacheEntry);
  },

  async clearCacheForWallet(walletId: string): Promise<void> {
    const db = await getDb();
    await db.delete('sig-cache', walletId);
  },

  async clearAll(): Promise<void> {
    const db = await getDb();
    await db.clear('sig-cache');
  },
};
