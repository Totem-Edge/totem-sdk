"use strict";
/**
 * @module LeaseMonitor
 * Monitors lease expiry and triggers renewal/cleanup actions
 *
 * Features:
 * - Automatic expiry detection with configurable thresholds
 * - Event-based notifications for expiring leases
 * - Adaptive monitoring interval based on shortest TTL
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaseMonitor = void 0;
const adapters_1 = require("../adapters");
const DEFAULT_CONFIG = {
    defaultIntervalMs: 5000,
    expiryThresholdMs: 5000,
    minIntervalMs: 1000,
    maxIntervalMs: 30000,
};
class LeaseMonitor {
    constructor(leaseStore, timer = new adapters_1.DefaultTimerAdapter(), logger = new adapters_1.NoopLogger(), config = {}) {
        this.timerHandle = null;
        this.isRunning = false;
        this.expiryCallbacks = new Set();
        this.leaseStore = leaseStore;
        this.timer = timer;
        this.logger = logger;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    start() {
        if (this.isRunning) {
            this.logger.debug('LeaseMonitor already running');
            return;
        }
        this.isRunning = true;
        this.scheduleNextCheck();
        this.logger.debug('LeaseMonitor started');
    }
    stop() {
        if (!this.isRunning)
            return;
        this.isRunning = false;
        if (this.timerHandle !== null) {
            this.timer.clearTimeout(this.timerHandle);
            this.timerHandle = null;
        }
        this.logger.debug('LeaseMonitor stopped');
    }
    isActive() {
        return this.isRunning;
    }
    onExpirySoon(callback) {
        this.expiryCallbacks.add(callback);
        return () => this.expiryCallbacks.delete(callback);
    }
    removeAllListeners() {
        this.expiryCallbacks.clear();
    }
    async checkNow() {
        const now = this.timer.now();
        const expiringSoon = this.leaseStore.getExpiringSoon(this.config.expiryThresholdMs);
        const events = expiringSoon.map(lease => ({
            leaseId: lease.leaseId,
            expiresAt: lease.expiresAt,
            remainingMs: Math.max(0, lease.expiresAt - now),
            lease,
        }));
        for (const event of events) {
            this.notifyExpirySoon(event);
        }
        await this.leaseStore.cleanupExpired();
        return events;
    }
    scheduleNextCheck() {
        if (!this.isRunning)
            return;
        const interval = this.calculateInterval();
        this.timerHandle = this.timer.setTimeout(() => {
            this.runCheck();
        }, interval);
        this.logger.debug(`Next lease check scheduled in ${interval}ms`);
    }
    async runCheck() {
        if (!this.isRunning)
            return;
        try {
            await this.checkNow();
        }
        catch (error) {
            this.logger.error('Error during lease check:', error);
        }
        this.scheduleNextCheck();
    }
    calculateInterval() {
        const storeInterval = this.leaseStore.calculateMonitoringInterval();
        const interval = Math.max(this.config.minIntervalMs, Math.min(storeInterval, this.config.maxIntervalMs));
        return interval;
    }
    notifyExpirySoon(event) {
        this.logger.debug(`Lease expiring soon: ${event.leaseId}, remaining: ${event.remainingMs}ms`);
        this.expiryCallbacks.forEach(callback => {
            try {
                callback(event);
            }
            catch (error) {
                this.logger.error('Error in expiry callback:', error);
            }
        });
    }
}
exports.LeaseMonitor = LeaseMonitor;
