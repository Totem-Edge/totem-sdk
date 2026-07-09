/**
 * SDK Stores for Node.js Wallet
 * 
 * Implementations of LeaseStore and WatermarkStore using the storage adapter.
 */

import type { StorageAdapter } from './adapters';

export interface Lease {
  leaseId: string;
  publicKey: string;
  startIndex: number;
  endIndex: number;
  createdAt: number;
  expiresAt: number;
  status: 'active' | 'expired' | 'revoked';
}

export interface LeaseStoreData {
  leases: Lease[];
  activeLease: string | null;
}

export class LeaseStore {
  private storage: StorageAdapter;
  private storageKey: string;

  constructor(storage: StorageAdapter, prefix: string = 'wallet') {
    this.storage = storage;
    this.storageKey = `${prefix}:leases`;
  }

  private async load(): Promise<LeaseStoreData> {
    const data = await this.storage.get(this.storageKey);
    if (!data) {
      return { leases: [], activeLease: null };
    }
    return JSON.parse(data);
  }

  private async persist(data: LeaseStoreData): Promise<void> {
    await this.storage.set(this.storageKey, JSON.stringify(data));
  }

  async saveLease(lease: Lease): Promise<void> {
    const data = await this.load();
    const existingIndex = data.leases.findIndex(l => l.leaseId === lease.leaseId);
    
    if (existingIndex >= 0) {
      data.leases[existingIndex] = lease;
    } else {
      data.leases.push(lease);
    }
    
    if (lease.status === 'active') {
      data.activeLease = lease.leaseId;
    }
    
    await this.persist(data);
  }

  async getById(leaseId: string): Promise<Lease | null> {
    const data = await this.load();
    return data.leases.find(l => l.leaseId === leaseId) || null;
  }

  async getActiveLease(): Promise<Lease | null> {
    const data = await this.load();
    if (!data.activeLease) return null;
    return this.getById(data.activeLease);
  }

  async setActiveLease(leaseId: string): Promise<void> {
    const data = await this.load();
    data.activeLease = leaseId;
    await this.persist(data);
  }

  async getAllLeases(): Promise<Lease[]> {
    const data = await this.load();
    return data.leases;
  }

  async getExpiredLeases(): Promise<Lease[]> {
    const data = await this.load();
    const now = Date.now();
    return data.leases.filter(l => l.expiresAt < now && l.status === 'active');
  }

  async markExpired(leaseId: string): Promise<void> {
    const data = await this.load();
    const lease = data.leases.find(l => l.leaseId === leaseId);
    if (lease) {
      lease.status = 'expired';
      if (data.activeLease === leaseId) {
        data.activeLease = null;
      }
      await this.persist(data);
    }
  }

  async revokeLease(leaseId: string): Promise<void> {
    const data = await this.load();
    const lease = data.leases.find(l => l.leaseId === leaseId);
    if (lease) {
      lease.status = 'revoked';
      if (data.activeLease === leaseId) {
        data.activeLease = null;
      }
      await this.persist(data);
    }
  }

  async clear(): Promise<void> {
    await this.storage.remove(this.storageKey);
  }
}

export interface WatermarkData {
  watermarks: Record<string, number>;
}

export class WatermarkStore {
  private storage: StorageAdapter;
  private storageKey: string;

  constructor(storage: StorageAdapter, prefix: string = 'wallet') {
    this.storage = storage;
    this.storageKey = `${prefix}:watermarks`;
  }

  private async load(): Promise<WatermarkData> {
    const data = await this.storage.get(this.storageKey);
    if (!data) {
      return { watermarks: {} };
    }
    return JSON.parse(data);
  }

  private async save(data: WatermarkData): Promise<void> {
    await this.storage.set(this.storageKey, JSON.stringify(data));
  }

  async getWatermark(publicKeyHash: string): Promise<number> {
    const data = await this.load();
    return data.watermarks[publicKeyHash] || 0;
  }

  async setWatermark(publicKeyHash: string, index: number): Promise<void> {
    const data = await this.load();
    const current = data.watermarks[publicKeyHash] || 0;
    
    if (index <= current) {
      throw new Error(`Cannot decrease watermark: current=${current}, requested=${index}`);
    }
    
    data.watermarks[publicKeyHash] = index;
    await this.save(data);
  }

  async advanceWatermark(publicKeyHash: string): Promise<number> {
    const current = await this.getWatermark(publicKeyHash);
    const next = current + 1;
    await this.setWatermark(publicKeyHash, next);
    return next;
  }

  async getAllWatermarks(): Promise<Record<string, number>> {
    const data = await this.load();
    return { ...data.watermarks };
  }

  async clear(): Promise<void> {
    await this.storage.remove(this.storageKey);
  }
}
