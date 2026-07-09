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
import type { StorageAdapter, LoggerAdapter } from '../adapters';
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
export declare class LeaseStore {
    private leases;
    private _initialized;
    private readonly storageKey;
    private readonly storage;
    private readonly logger;
    constructor(storage: StorageAdapter, logger?: LoggerAdapter, config?: LeaseStoreConfig);
    initialize(): Promise<void>;
    isInitialized(): boolean;
    private load;
    private persist;
    save(lease: StoredLease): Promise<void>;
    get(leaseId: string): StoredLease | undefined;
    getByToken(leaseToken: string): StoredLease | undefined;
    getAll(): StoredLease[];
    getActive(): StoredLease[];
    getExpiringSoon(thresholdMs?: number): StoredLease[];
    delete(leaseId: string): Promise<boolean>;
    deleteByToken(leaseToken: string): Promise<boolean>;
    updateStatus(leaseId: string, status: LeaseStatus): Promise<void>;
    cleanupExpired(): Promise<number>;
    clear(): Promise<void>;
    getMinimumTTL(): number | null;
    calculateMonitoringInterval(): number;
    private flattenIndex;
}
