/**
 * @module LeaseMonitor
 * Monitors lease expiry and triggers renewal/cleanup actions
 *
 * Features:
 * - Automatic expiry detection with configurable thresholds
 * - Event-based notifications for expiring leases
 * - Adaptive monitoring interval based on shortest TTL
 */
import type { TimerAdapter, LoggerAdapter } from '../adapters';
import type { LeaseStore, StoredLease } from './LeaseStore';
export interface LeaseExpiryEvent {
    leaseId: string;
    expiresAt: number;
    remainingMs: number;
    lease: StoredLease;
}
export type LeaseExpiryCallback = (event: LeaseExpiryEvent) => void;
export interface LeaseMonitorConfig {
    defaultIntervalMs?: number;
    expiryThresholdMs?: number;
    minIntervalMs?: number;
    maxIntervalMs?: number;
}
export declare class LeaseMonitor {
    private readonly leaseStore;
    private readonly timer;
    private readonly logger;
    private readonly config;
    private timerHandle;
    private isRunning;
    private expiryCallbacks;
    constructor(leaseStore: LeaseStore, timer?: TimerAdapter, logger?: LoggerAdapter, config?: LeaseMonitorConfig);
    start(): void;
    stop(): void;
    isActive(): boolean;
    onExpirySoon(callback: LeaseExpiryCallback): () => void;
    removeAllListeners(): void;
    checkNow(): Promise<LeaseExpiryEvent[]>;
    private scheduleNextCheck;
    private runCheck;
    private calculateInterval;
    private notifyExpirySoon;
}
