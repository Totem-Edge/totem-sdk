/**
 * Periodic Watermark Refresh
 * 
 * Background timer that syncs watermark every 5 minutes
 * Prevents signing with stale indices when another device has advanced the server watermark
 */

import { syncWatermark } from './watermark';

export class PeriodicWatermarkSync {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private isRunning = false;
  private rootPublicKey: string | null = null;

  start(rootPublicKey: string): void {
    if (this.isRunning) {
      console.log('[PeriodicWatermarkSync] Already running, skipping start');
      return;
    }

    this.rootPublicKey = rootPublicKey;
    this.isRunning = true;

    console.log('[PeriodicWatermarkSync] Starting periodic sync every', this.SYNC_INTERVAL_MS / 1000 / 60, 'minutes');

    this.intervalId = setInterval(async () => {
      await this.performSync();
    }, this.SYNC_INTERVAL_MS);

    this.performSync();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.rootPublicKey = null;
    console.log('[PeriodicWatermarkSync] Stopped');
  }

  private async performSync(): Promise<void> {
    if (!this.rootPublicKey) {
      console.warn('[PeriodicWatermarkSync] No root public key set, skipping sync');
      return;
    }

    try {
      console.log('[PeriodicWatermarkSync] Running scheduled watermark sync...');
      const result = await syncWatermark(this.rootPublicKey);

      if (result.multiDeviceConflict) {
        console.warn('[PeriodicWatermarkSync] ⚠ Multi-device drift detected during periodic sync:', result.drift, 'indices');
      }

      if (result.updated) {
        console.log('[PeriodicWatermarkSync] ✓ Watermark updated during periodic sync');
      } else {
        console.log('[PeriodicWatermarkSync] ✓ Watermark already up-to-date');
      }
    } catch (error: any) {
      console.error('[PeriodicWatermarkSync] Periodic sync failed:', error.message);
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }

  async syncNow(): Promise<void> {
    if (!this.rootPublicKey) {
      throw new Error('Periodic sync not started - no root public key');
    }
    await this.performSync();
  }
}

export const periodicWatermarkSync = new PeriodicWatermarkSync();
