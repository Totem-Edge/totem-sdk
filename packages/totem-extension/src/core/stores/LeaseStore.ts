/**
 * LeaseStore - WOTS Signature Lease Management
 * 
 * Updated 2026-02-05 for Per-Address TreeKey Architecture:
 * - Leases now track (addressIndex, l1, l2) instead of (l1, l2, l3)
 * - Each address has its own TreeKey with 4,096 signatures
 * 
 * Security: Uses async mutex to prevent concurrent load/save races
 * that could corrupt lease state or allow duplicate indices.
 */

import type { SigningIndices, WotsIndices } from './WatermarkStore';

export type LeaseStatus = 'pending' | 'active' | 'expired' | 'finalized' | 'cancelled';

export interface StoredLease {
  leaseId: string;
  leaseToken: string;
  indices: SigningIndices;
  expiresAt: number;
  status: LeaseStatus;
  createdAt: number;
  txId?: string;
  leaseTTL: number;
}

/** @deprecated */
export interface LegacyStoredLease {
  leaseId: string;
  leaseToken: string;
  indices: WotsIndices;
  expiresAt: number;
  status: LeaseStatus;
  createdAt: number;
  txId?: string;
  leaseTTL: number;
}

const STORAGE_KEY = 'totem_wots_leases';

class AsyncMutex {
  private _queue: Array<() => void> = [];
  private _locked = false;

  async acquire(): Promise<void> {
    if (!this._locked) {
      this._locked = true;
      return;
    }
    return new Promise<void>((resolve) => {
      this._queue.push(resolve);
    });
  }

  release(): void {
    if (this._queue.length > 0) {
      const next = this._queue.shift()!;
      next();
    } else {
      this._locked = false;
    }
  }
}

export class LeaseStore {
  private leases: Map<string, StoredLease> = new Map();
  private mutex = new AsyncMutex();

  async load(): Promise<void> {
    await this.mutex.acquire();
    try {
      await this._loadUnsafe();
    } finally {
      this.mutex.release();
    }
  }

  private async _loadUnsafe(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      if (result[STORAGE_KEY]) {
        const leasesArray: (StoredLease | LegacyStoredLease)[] = result[STORAGE_KEY];
        
        const migratedLeases: StoredLease[] = leasesArray.map(lease => {
          if ('l3' in lease.indices) {
            const legacyIndices = lease.indices as WotsIndices;
            return {
              ...lease,
              indices: {
                addressIndex: legacyIndices.l1,
                l1: legacyIndices.l2,
                l2: legacyIndices.l3
              }
            } as StoredLease;
          }
          return lease as StoredLease;
        });
        
        this.leases = new Map(migratedLeases.map(lease => [lease.leaseId, lease]));
      }
    } catch (error) {
      console.error('[LeaseStore] Failed to load leases:', error);
    }
  }

  private async persist(): Promise<void> {
    try {
      const leasesArray = Array.from(this.leases.values());
      await chrome.storage.local.set({
        [STORAGE_KEY]: leasesArray
      });
    } catch (error) {
      console.error('[LeaseStore] Failed to persist leases:', error);
      throw error;
    }
  }

  async save(lease: StoredLease): Promise<void> {
    await this.mutex.acquire();
    try {
      this.leases.set(lease.leaseId, lease);
      await this.persist();
    } finally {
      this.mutex.release();
    }
  }

  get(leaseId: string): StoredLease | undefined {
    return this.leases.get(leaseId);
  }

  getByToken(leaseToken: string): StoredLease | undefined {
    return Array.from(this.leases.values()).find(
      lease => lease.leaseToken === leaseToken
    );
  }

  getAll(): StoredLease[] {
    return Array.from(this.leases.values());
  }

  getActive(): StoredLease[] {
    const now = Date.now();
    return this.getAll().filter(lease => 
      lease.status === 'active' && lease.expiresAt > now
    );
  }

  getActiveForAddress(addressIndex: number): StoredLease[] {
    const now = Date.now();
    return this.getAll().filter(lease => 
      lease.indices.addressIndex === addressIndex &&
      lease.status === 'active' && 
      lease.expiresAt > now
    );
  }

  async delete(leaseId: string): Promise<boolean> {
    await this.mutex.acquire();
    try {
      const existed = this.leases.delete(leaseId);
      if (existed) {
        await this.persist();
      }
      return existed;
    } finally {
      this.mutex.release();
    }
  }

  async deleteByToken(leaseToken: string): Promise<boolean> {
    const lease = this.getByToken(leaseToken);
    if (lease) {
      return this.delete(lease.leaseId);
    }
    return false;
  }

  async updateStatus(leaseId: string, status: LeaseStatus): Promise<void> {
    await this.mutex.acquire();
    try {
      const lease = this.leases.get(leaseId);
      if (lease) {
        lease.status = status;
        await this.persist();
      }
    } finally {
      this.mutex.release();
    }
  }

  async cleanupExpired(): Promise<number> {
    await this.mutex.acquire();
    try {
      const now = Date.now();
      const expiredLeaseIds: string[] = [];

      for (const [leaseId, lease] of this.leases.entries()) {
        if (lease.expiresAt <= now && lease.status !== 'finalized') {
          lease.status = 'expired';
          expiredLeaseIds.push(leaseId);
        }
      }

      if (expiredLeaseIds.length > 0) {
        await this.persist();
      }

      return expiredLeaseIds.length;
    } finally {
      this.mutex.release();
    }
  }

  async clear(): Promise<void> {
    await this.mutex.acquire();
    try {
      this.leases.clear();
      await chrome.storage.local.remove(STORAGE_KEY);
    } finally {
      this.mutex.release();
    }
  }

  getExpiringSoon(thresholdMs: number = 5000): StoredLease[] {
    const now = Date.now();
    return this.getAll().filter(lease => 
      lease.status === 'active' && 
      lease.expiresAt > now &&
      lease.expiresAt <= now + thresholdMs
    );
  }

  getMinimumTTL(): number | null {
    const activeLeases = this.getActive();
    if (activeLeases.length === 0) return null;
    
    return Math.min(...activeLeases.map(lease => lease.leaseTTL));
  }

  calculateMonitoringInterval(): number {
    const minTTL = this.getMinimumTTL();
    if (minTTL === null) return 5000;
    
    const calculatedInterval = Math.min(minTTL / 4, 5000);
    return Math.max(calculatedInterval, 1000);
  }

  async initialize(): Promise<void> {
    await this.load();
    await this.cleanupExpired();
  }
}

export const leaseStore = new LeaseStore();
