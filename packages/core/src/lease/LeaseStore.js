"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaseStore = void 0;
const adapters_1 = require("../adapters");
const DEFAULT_STORAGE_KEY = 'totem_wots_leases';
class LeaseStore {
    constructor(storage, logger = new adapters_1.NoopLogger(), config = {}) {
        this.leases = new Map();
        this._initialized = false;
        this.storage = storage;
        this.logger = logger;
        this.storageKey = config.storageKey ?? DEFAULT_STORAGE_KEY;
    }
    async initialize() {
        if (this._initialized)
            return;
        await this.load();
        await this.cleanupExpired();
        this._initialized = true;
    }
    isInitialized() {
        return this._initialized;
    }
    async load() {
        try {
            const leasesArray = await this.storage.get(this.storageKey);
            if (leasesArray) {
                this.leases = new Map(leasesArray.map(lease => [lease.leaseId, lease]));
                this.logger.debug(`Loaded ${this.leases.size} leases from storage`);
            }
        }
        catch (error) {
            this.logger.error('Failed to load leases:', error);
        }
    }
    async persist() {
        try {
            const leasesArray = Array.from(this.leases.values());
            await this.storage.set(this.storageKey, leasesArray);
        }
        catch (error) {
            this.logger.error('Failed to persist leases:', error);
            throw error;
        }
    }
    async save(lease) {
        const flatIndex = this.flattenIndex(lease.indices);
        this.logger.debug(`Storing lease: ${lease.leaseId}`);
        this.logger.debug(`  indices: (addressIndex=${lease.indices.addressIndex}, l1=${lease.indices.l1}, l2=${lease.indices.l2}) [${flatIndex}/262,144]`);
        this.logger.debug(`  status: ${lease.status}, TTL: ${lease.leaseTTL}ms`);
        this.leases.set(lease.leaseId, lease);
        await this.persist();
    }
    get(leaseId) {
        return this.leases.get(leaseId);
    }
    getByToken(leaseToken) {
        return Array.from(this.leases.values()).find(lease => lease.leaseToken === leaseToken);
    }
    getAll() {
        return Array.from(this.leases.values());
    }
    getActive() {
        const now = Date.now();
        return this.getAll().filter(lease => lease.status === 'active' && lease.expiresAt > now);
    }
    getExpiringSoon(thresholdMs = 5000) {
        const now = Date.now();
        return this.getAll().filter(lease => lease.status === 'active' &&
            lease.expiresAt > now &&
            lease.expiresAt <= now + thresholdMs);
    }
    async delete(leaseId) {
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
    async deleteByToken(leaseToken) {
        const lease = this.getByToken(leaseToken);
        if (lease) {
            return this.delete(lease.leaseId);
        }
        return false;
    }
    async updateStatus(leaseId, status) {
        const lease = this.leases.get(leaseId);
        if (lease) {
            const oldStatus = lease.status;
            this.logger.debug(`Lease status change: ${leaseId} ${oldStatus} → ${status}`);
            lease.status = status;
            await this.persist();
        }
    }
    async cleanupExpired() {
        const now = Date.now();
        const expiredLeaseIds = [];
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
    async clear() {
        this.leases.clear();
        await this.storage.remove(this.storageKey);
        this.logger.debug('Cleared all leases');
    }
    getMinimumTTL() {
        const activeLeases = this.getActive();
        if (activeLeases.length === 0)
            return null;
        return Math.min(...activeLeases.map(lease => lease.leaseTTL));
    }
    calculateMonitoringInterval() {
        const minTTL = this.getMinimumTTL();
        if (minTTL === null)
            return 5000;
        const calculatedInterval = Math.min(minTTL / 4, 5000);
        return Math.max(calculatedInterval, 1000);
    }
    flattenIndex(indices) {
        return (indices.addressIndex * 64 * 64) + (indices.l1 * 64) + indices.l2;
    }
}
exports.LeaseStore = LeaseStore;
