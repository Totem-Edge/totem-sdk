/**
 * @module LeaseMonitor
 * Monitors lease expiry and triggers renewal/cleanup actions
 * 
 * Features:
 * - Automatic expiry detection with configurable thresholds
 * - Event-based notifications for expiring leases
 * - Adaptive monitoring interval based on shortest TTL
 */

import type { TimerAdapter, LoggerAdapter } from '../adapters/index.js';
import { DefaultTimerAdapter, NoopLogger, type TimerHandle } from '../adapters/index.js';
import type { LeaseStore, StoredLease } from './LeaseStore.js';

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

const DEFAULT_CONFIG: Required<LeaseMonitorConfig> = {
  defaultIntervalMs: 5000,
  expiryThresholdMs: 5000,
  minIntervalMs: 1000,
  maxIntervalMs: 30000,
};

export class LeaseMonitor {
  private readonly leaseStore: LeaseStore;
  private readonly timer: TimerAdapter;
  private readonly logger: LoggerAdapter;
  private readonly config: Required<LeaseMonitorConfig>;
  
  private timerHandle: TimerHandle | null = null;
  private isRunning = false;
  private expiryCallbacks = new Set<LeaseExpiryCallback>();

  constructor(
    leaseStore: LeaseStore,
    timer: TimerAdapter = new DefaultTimerAdapter(),
    logger: LoggerAdapter = new NoopLogger(),
    config: LeaseMonitorConfig = {}
  ) {
    this.leaseStore = leaseStore;
    this.timer = timer;
    this.logger = logger;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(): void {
    if (this.isRunning) {
      this.logger.debug('LeaseMonitor already running');
      return;
    }

    this.isRunning = true;
    this.scheduleNextCheck();
    this.logger.debug('LeaseMonitor started');
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.timerHandle !== null) {
      this.timer.clearTimeout(this.timerHandle);
      this.timerHandle = null;
    }
    this.logger.debug('LeaseMonitor stopped');
  }

  isActive(): boolean {
    return this.isRunning;
  }

  onExpirySoon(callback: LeaseExpiryCallback): () => void {
    this.expiryCallbacks.add(callback);
    return () => this.expiryCallbacks.delete(callback);
  }

  removeAllListeners(): void {
    this.expiryCallbacks.clear();
  }

  async checkNow(): Promise<LeaseExpiryEvent[]> {
    const now = this.timer.now();
    const expiringSoon = this.leaseStore.getExpiringSoon(this.config.expiryThresholdMs);
    
    const events: LeaseExpiryEvent[] = expiringSoon.map(lease => ({
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

  private scheduleNextCheck(): void {
    if (!this.isRunning) return;

    const interval = this.calculateInterval();
    this.timerHandle = this.timer.setTimeout(() => {
      this.runCheck();
    }, interval);

    this.logger.debug(`Next lease check scheduled in ${interval}ms`);
  }

  private async runCheck(): Promise<void> {
    if (!this.isRunning) return;

    try {
      await this.checkNow();
    } catch (error) {
      this.logger.error('Error during lease check:', error);
    }

    this.scheduleNextCheck();
  }

  private calculateInterval(): number {
    const storeInterval = this.leaseStore.calculateMonitoringInterval();
    const interval = Math.max(
      this.config.minIntervalMs,
      Math.min(storeInterval, this.config.maxIntervalMs)
    );
    return interval;
  }

  private notifyExpirySoon(event: LeaseExpiryEvent): void {
    this.logger.debug(`Lease expiring soon: ${event.leaseId}, remaining: ${event.remainingMs}ms`);
    this.expiryCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        this.logger.error('Error in expiry callback:', error);
      }
    });
  }
}
