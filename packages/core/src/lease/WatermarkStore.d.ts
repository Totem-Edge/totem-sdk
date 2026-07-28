/**
 * @module WatermarkStore
 * WOTS index tracking with server synchronization
 *
 * Uses in-memory cache backed by persistent storage.
 * Pattern:
 * - initialize() loads from storage into memory cache (or creates default)
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
export interface WatermarkState {
    next_addressIndex: number;
    next_l1: number;
    next_l2: number;
    usedIndices: Array<[number, number, number]>;
    lastSyncTimestamp?: number;
    serverWatermark?: WotsIndices;
}
export interface SyncResult {
    updated: boolean;
    drift: number;
    hasConflict: boolean;
}
export interface WatermarkStoreConfig {
    storageKey?: string;
}
export declare class WatermarkStore {
    private state;
    private _initialized;
    private readonly storageKey;
    private readonly storage;
    private readonly logger;
    constructor(storage: StorageAdapter, logger?: LoggerAdapter, config?: WatermarkStoreConfig);
    initialize(): Promise<WatermarkState>;
    isInitialized(): boolean;
    load(): Promise<WatermarkState | null>;
    save(watermark: WatermarkState): Promise<void>;
    clear(): Promise<void>;
    getCurrent(): WatermarkState | null;
    getNextIndices(): WotsIndices | null;
    isExhausted(): boolean;
    hasAvailableIndices(): boolean;
    markUsed(indices: WotsIndices): Promise<void>;
    advanceWatermark(indices: WotsIndices): Promise<void>;
    updateFromServer(serverWatermark: WotsIndices): Promise<SyncResult>;
    getUsageStats(): {
        used: number;
        total: number;
        percentage: number;
    };
    private calculateNextIndices;
    private shouldUseServerWatermark;
    private flattenIndex;
}
