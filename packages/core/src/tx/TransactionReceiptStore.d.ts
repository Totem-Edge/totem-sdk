/**
 * @module TransactionReceiptStore
 * Persistent storage for transaction receipts
 *
 * Uses in-memory cache backed by persistent storage.
 * Pattern:
 * - initialize() loads from storage into memory cache
 * - Sync getters read from memory cache (fast, no I/O)
 * - Mutators update memory cache AND persist to storage
 */
import type { StorageAdapter, LoggerAdapter } from '../adapters';
import type { TransactionReceipt } from './types';
export interface TransactionReceiptStoreConfig {
    storageKey?: string;
    maxReceipts?: number;
}
export declare class TransactionReceiptStore {
    private receipts;
    private _initialized;
    private readonly storageKey;
    private readonly maxReceipts;
    private readonly storage;
    private readonly logger;
    constructor(storage: StorageAdapter, logger?: LoggerAdapter, config?: TransactionReceiptStoreConfig);
    initialize(): Promise<void>;
    isInitialized(): boolean;
    private load;
    private persist;
    add(receipt: TransactionReceipt): Promise<void>;
    getAll(): TransactionReceipt[];
    getByTxpowid(txpowid: string): TransactionReceipt | undefined;
    getRecent(count?: number): TransactionReceipt[];
    updateStatus(txpowid: string, status: TransactionReceipt['status']): Promise<void>;
    clear(): Promise<void>;
    count(): number;
}
