/**
 * @module LeaseStore
 * WOTS lease lifecycle management with platform-agnostic storage
 * 
 * Uses in-memory cache backed by persistent storage.
 * Pattern:
 * - initialize() loads from storage into memory cache
 * - Sync getters read from memory cache (fast, no I/O)
 * - Mutators update memory cache AND persist to storage
 * - Caller MUST call initialize() before using sync getters
 */

import type { StorageAdapter, LoggerAdapter } from '../adapters/index.js';
import { NoopLogger } from '../adapters/index.js';

export interface WotsIndices {
  addressIndex: number;
  l1: number;
  l2: number;
}

export type LeaseStatus = 'pending' | 'active' | 'expired' | 'finalized' | 'cancelled';

export interface StoredLease {
  leaseId: string;
  leaseToken: string;
  indices: WotsIndices;
  expiresAt: number;
  status: LeaseStatus;
  createdAt: number;
  txId?: string;
  leaseTTL: number;
}

export interface LeaseStoreConfig {
  storageKey?: string;
}

const DEFAULT_STORAGE_KEY = 'totem_wots_leases';

export class LeaseStore {
  private leases: Map<string, StoredLease> = new Map();
  private _initialized = false;
  private readonly storageKey: string;
  private readonly storage: StorageAdapter;
  private readonly logger: LoggerAdapter;

  constructor(
    storage: StorageAdapter,
    logger: LoggerAdapter = new NoopLogger(),
    config: LeaseStoreConfig = {}
  ) {
    this.storage = storage;
    this.logger = logger;
    this.storageKey = config.storageKey ?? DEFAULT_STORAGE_KEY;
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;

    await this.load();
    await this.cleanupExpired();
    this._initialized = true;
  }

  isInitialized(): boolean {
    return this._initialized;
  }

  private async load(): Promise<void> {
    try {
      const leasesArray = await this.storage.get<StoredLease[]>(this.storageKey);
      if (leasesArray) {
        this.leases = new Map(leasesArray.map(lease => [lease.leaseId, lease]));
        this.logger.debug(`Loaded ${this.leases.size} leases from storage`);
      }
    } catch (error) {
      this.logger.error('Failed to load leases:', error);
    }
  }

  private async persist(): Promise<void> {
    try {
      const leasesArray = Array.from(this.leases.values());
      await this.storage.set(this.storageKey, leasesArray);
    } catch (error) {
      this.logger.error('Failed to persist leases:', error);
      throw error;
    }
  }

  async save(lease: StoredLease): Promise<void> {
    const flatIndex = this.flattenIndex(lease.indices);
    this.logger.debug(`Storing lease: ${lease.leaseId}`);
    this.logger.debug(`  indices: (addressIndex=${lease.indices.addressIndex}, l1=${lease.indices.l1}, l2=${lease.indices.l2}) [${flatIndex}/262,144]`);
    this.logger.debug(`  status: ${lease.status}, TTL: ${lease.leaseTTL}ms`);
    
    this.leases.set(lease.leaseId, lease);
    await this.persist();
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

  getExpiringSoon(thresholdMs: number = 5000): StoredLease[] {
    const now = Date.now();
    return this.getAll().filter(lease => 
      lease.status === 'active' && 
      lease.expiresAt > now &&
      lease.expiresAt <= now + thresholdMs
    );
  }

  async delete(leaseId: string): Promise<boolean> {
    const lease = this.leases.get(leaseId);
    if (lease) {
      this.logger.debug(`Deleting lease: ${leaseId}, final status: ${lease.status}`);
    }
    const existed = this.leases.delete(leaseId);
    if (existed) {
      await this.persist();
    }
    return existed;
  }

  async deleteByToken(leaseToken: string): Promise<boolean> {
    const lease = this.getByToken(leaseToken);
    if (lease) {
      return this.delete(lease.leaseId);
    }
    return false;
  }

  async updateStatus(leaseId: string, status: LeaseStatus): Promise<void> {
    const lease = this.leases.get(leaseId);
    if (lease) {
      const oldStatus = lease.status;
      this.logger.debug(`Lease status change: ${leaseId} ${oldStatus} → ${status}`);
      lease.status = status;
      await this.persist();
    }
  }

  async cleanupExpired(): Promise<number> {
    const now = Date.now();
    const expiredLeaseIds: string[] = [];

    for (const [leaseId, lease] of this.leases.entries()) {
      if (lease.expiresAt <= now && lease.status !== 'finalized') {
        lease.status = 'expired';
        expiredLeaseIds.push(leaseId);
      }
    }

    if (expiredLeaseIds.length > 0) {
      this.logger.debug(`Marked ${expiredLeaseIds.length} leases as expired`);
      await this.persist();
    }

    return expiredLeaseIds.length;
  }

  async clear(): Promise<void> {
    this.leases.clear();
    await this.storage.remove(this.storageKey);
    this.logger.debug('Cleared all leases');
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

  private flattenIndex(indices: WotsIndices): number {
    return (indices.addressIndex * 64 * 64) + (indices.l1 * 64) + indices.l2;
  }
}
