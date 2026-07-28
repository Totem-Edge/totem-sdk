/**
 * Lease TTL Monitoring
 * Background timer that checks active leases and handles expiration
 */

import { leaseStore } from '../stores';

export interface LeaseExpiryEvent {
  leaseId: string;
  leaseToken: string;
  expiresAt: number;
  remainingMs: number;
}

export type LeaseExpiryCallback = (event: LeaseExpiryEvent) => void;

export class LeaseMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private expiryCallbacks: LeaseExpiryCallback[] = [];

  start(): void {
    if (this.isRunning) {
      console.log('[LeaseMonitor] Already running');
      return;
    }

    this.stop();

    this.isRunning = true;
    this.scheduleNextCheck();
    console.log('[LeaseMonitor] Started');
  }

  stop(): void {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.expiryCallbacks = [];
  }

  onExpiry(callback: LeaseExpiryCallback): void {
    this.expiryCallbacks.push(callback);
  }

  private scheduleNextCheck(): void {
    if (!this.isRunning) return;

    const interval = leaseStore.calculateMonitoringInterval();
    
    this.intervalId = setTimeout(() => {
      this.checkLeases();
      this.scheduleNextCheck();
    }, interval);
  }

  private async checkLeases(): Promise<void> {
    try {
      await leaseStore.load();

      const expiredCount = await leaseStore.cleanupExpired();
      if (expiredCount > 0) {
        console.log(`[LeaseMonitor] Cleaned up ${expiredCount} expired leases`);
      }

      const expiringSoon = leaseStore.getExpiringSoon(10000);
      if (expiringSoon.length > 0) {
        console.warn(`[LeaseMonitor] ${expiringSoon.length} leases expiring within 10 seconds`);
        
        expiringSoon.forEach(lease => {
          const event: LeaseExpiryEvent = {
            leaseId: lease.leaseId,
            leaseToken: lease.leaseToken,
            expiresAt: lease.expiresAt,
            remainingMs: lease.expiresAt - Date.now()
          };

          this.expiryCallbacks.forEach(callback => {
            try {
              callback(event);
            } catch (error) {
              console.error('[LeaseMonitor] Callback error:', error);
            }
          });
        });
      }

    } catch (error) {
      console.error('[LeaseMonitor] Error checking leases:', error);
    }
  }
}

export const leaseMonitor = new LeaseMonitor();
