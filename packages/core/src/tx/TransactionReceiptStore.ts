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

import type { StorageAdapter, LoggerAdapter } from '../adapters/index.js';
import { NoopLogger } from '../adapters/index.js';
import type { TransactionReceipt } from './types.js';

export interface TransactionReceiptStoreConfig {
  storageKey?: string;
  maxReceipts?: number;
}

const DEFAULT_STORAGE_KEY = 'totem_transaction_receipts';
const DEFAULT_MAX_RECEIPTS = 1000;

export class TransactionReceiptStore {
  private receipts: TransactionReceipt[] = [];
  private _initialized = false;
  private readonly storageKey: string;
  private readonly maxReceipts: number;
  private readonly storage: StorageAdapter;
  private readonly logger: LoggerAdapter;

  constructor(
    storage: StorageAdapter,
    logger: LoggerAdapter = new NoopLogger(),
    config: TransactionReceiptStoreConfig = {}
  ) {
    this.storage = storage;
    this.logger = logger;
    this.storageKey = config.storageKey ?? DEFAULT_STORAGE_KEY;
    this.maxReceipts = config.maxReceipts ?? DEFAULT_MAX_RECEIPTS;
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;
    await this.load();
    this._initialized = true;
  }

  isInitialized(): boolean {
    return this._initialized;
  }

  private async load(): Promise<void> {
    const receipts = await this.storage.get<TransactionReceipt[]>(this.storageKey);
    if (receipts) {
      this.receipts = receipts;
      this.logger.debug(`Loaded ${this.receipts.length} transaction receipts`);
    }
  }

  private async persist(): Promise<void> {
    const trimmedReceipts = this.receipts.slice(-this.maxReceipts);
    await this.storage.set(this.storageKey, trimmedReceipts);
    this.receipts = trimmedReceipts;
  }

  async add(receipt: TransactionReceipt): Promise<void> {
    this.receipts.push(receipt);
    this.logger.debug(`Added receipt: ${receipt.txpowid}`);
    try {
      await this.persist();
    } catch (error) {
      this.receipts.pop();
      throw error;
    }
  }

  getAll(): TransactionReceipt[] {
    return [...this.receipts].reverse();
  }

  getByTxpowid(txpowid: string): TransactionReceipt | undefined {
    return this.receipts.find(r => r.txpowid === txpowid);
  }

  getRecent(count: number = 50): TransactionReceipt[] {
    return this.getAll().slice(0, count);
  }

  async updateStatus(txpowid: string, status: TransactionReceipt['status']): Promise<void> {
    const receipt = this.receipts.find(r => r.txpowid === txpowid);
    if (receipt) {
      const previousStatus = receipt.status;
      receipt.status = status;
      this.logger.debug(`Updated receipt status: ${txpowid} → ${status}`);
      try {
        await this.persist();
      } catch (error) {
        receipt.status = previousStatus;
        throw error;
      }
    }
  }

  async clear(): Promise<void> {
    const previous = this.receipts;
    this.receipts = [];
    try {
      await this.storage.remove(this.storageKey);
      this.logger.debug('Cleared all receipts');
    } catch (error) {
      this.receipts = previous;
      throw error;
    }
  }

  count(): number {
    return this.receipts.length;
  }
}
