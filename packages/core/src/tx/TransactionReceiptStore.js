"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionReceiptStore = void 0;
const adapters_1 = require("../adapters");
const DEFAULT_STORAGE_KEY = 'totem_transaction_receipts';
const DEFAULT_MAX_RECEIPTS = 1000;
class TransactionReceiptStore {
    constructor(storage, logger = new adapters_1.NoopLogger(), config = {}) {
        this.receipts = [];
        this._initialized = false;
        this.storage = storage;
        this.logger = logger;
        this.storageKey = config.storageKey ?? DEFAULT_STORAGE_KEY;
        this.maxReceipts = config.maxReceipts ?? DEFAULT_MAX_RECEIPTS;
    }
    async initialize() {
        if (this._initialized)
            return;
        await this.load();
        this._initialized = true;
    }
    isInitialized() {
        return this._initialized;
    }
    async load() {
        try {
            const receipts = await this.storage.get(this.storageKey);
            if (receipts) {
                this.receipts = receipts;
                this.logger.debug(`Loaded ${this.receipts.length} transaction receipts`);
            }
        }
        catch (error) {
            this.logger.error('Failed to load receipts:', error);
        }
    }
    async persist() {
        try {
            const trimmedReceipts = this.receipts.slice(-this.maxReceipts);
            await this.storage.set(this.storageKey, trimmedReceipts);
            this.receipts = trimmedReceipts;
        }
        catch (error) {
            this.logger.error('Failed to persist receipts:', error);
            throw error;
        }
    }
    async add(receipt) {
        this.receipts.push(receipt);
        this.logger.debug(`Added receipt: ${receipt.txpowid}`);
        await this.persist();
    }
    getAll() {
        return [...this.receipts].reverse();
    }
    getByTxpowid(txpowid) {
        return this.receipts.find(r => r.txpowid === txpowid);
    }
    getRecent(count = 50) {
        return this.getAll().slice(0, count);
    }
    async updateStatus(txpowid, status) {
        const receipt = this.receipts.find(r => r.txpowid === txpowid);
        if (receipt) {
            receipt.status = status;
            this.logger.debug(`Updated receipt status: ${txpowid} → ${status}`);
            await this.persist();
        }
    }
    async clear() {
        this.receipts = [];
        await this.storage.remove(this.storageKey);
        this.logger.debug('Cleared all receipts');
    }
    count() {
        return this.receipts.length;
    }
}
exports.TransactionReceiptStore = TransactionReceiptStore;
