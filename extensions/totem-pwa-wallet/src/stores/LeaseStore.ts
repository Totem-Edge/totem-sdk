/**
 * LeaseStore — persistent WOTS lease tracking in IndexedDB.
 *
 * Tracks lease lifecycle: pending → active → expired/finalized/cancelled.
 * Prevents orphaned WOTS key slots on crash by detecting stale leases on startup.
 */
import { openDB, type IDBPDatabase } from 'idb';

export type LeaseStatus = 'pending' | 'active' | 'expired' | 'finalized' | 'cancelled';

export interface LeaseRecord {
  leaseToken: string;
  txId: string;
  addressIndex: number;
  l1: number;
  l2: number;
  status: LeaseStatus;
  createdAt: number;
  expiresAt: number;
  finalizedAt?: number;
}

const DB_NAME = 'totem-pwa-wallet';
const DB_VERSION = 2;

let _db: IDBPDatabase | null = null;

async function getDb(): Promise<IDBPDatabase> {
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (!db.objectStoreNames.contains('leases')) {
        db.createObjectStore('leases', { keyPath: 'leaseToken' });
      }
    },
  });
  return _db;
}

export const LeaseStore = {
  async saveLease(lease: LeaseRecord): Promise<void> {
    const db = await getDb();
    await db.put('leases', lease);
  },

  async getLease(leaseToken: string): Promise<LeaseRecord | undefined> {
    const db = await getDb();
    return db.get('leases', leaseToken);
  },

  async updateStatus(leaseToken: string, status: LeaseStatus): Promise<void> {
    const db = await getDb();
    const lease = await db.get('leases', leaseToken);
    if (lease) {
      lease.status = status;
      if (status === 'finalized' || status === 'cancelled') {
        lease.finalizedAt = Date.now();
      }
      await db.put('leases', lease);
    }
  },

  async getActiveLeases(): Promise<LeaseRecord[]> {
    const db = await getDb();
    const all = await db.getAll('leases');
    return all.filter(l => l.status === 'active' || l.status === 'pending');
  },

  async expireStaleLeases(maxAgeMs = 300000): Promise<number> {
    const db = await getDb();
    const all = await db.getAll('leases');
    const now = Date.now();
    let expired = 0;
    for (const lease of all) {
      if ((lease.status === 'active' || lease.status === 'pending') && now > lease.expiresAt) {
        lease.status = 'expired';
        await db.put('leases', lease);
        expired++;
      }
    }
    return expired;
  },

  async clearAll(): Promise<void> {
    const db = await getDb();
    await db.clear('leases');
  },
};
