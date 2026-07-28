/**
 * Service Worker Startup Recovery
 * 
 * Rehydrates WatermarkStore and LeaseStore after service worker restart/crash
 * Cleans up expired leases and logs recovery status
 * 
 * Updated 2026-02-05 for Per-Address TreeKey Architecture
 */

import { watermarkStore, leaseStore } from '../stores';

export interface RecoveryReport {
  watermarkLoaded: boolean;
  leasesRehydrated: number;
  expiredLeasesClean: number;
  activeLeasesRecovered: number;
  timestamp: number;
  errors: string[];
}

export async function performStartupRecovery(): Promise<RecoveryReport> {
  const report: RecoveryReport = {
    watermarkLoaded: false,
    leasesRehydrated: 0,
    expiredLeasesClean: 0,
    activeLeasesRecovered: 0,
    timestamp: Date.now(),
    errors: []
  };

  console.log('[StartupRecovery] Beginning service worker rehydration...');

  try {
    await watermarkStore.initialize();
    const watermarkState = watermarkStore.getCurrent();
    
    if (watermarkState) {
      report.watermarkLoaded = true;
      const usage = watermarkStore.getTotalUsage();
      console.log('[StartupRecovery] ✓ Watermark rehydrated:', {
        version: watermarkState.version,
        totalUsed: usage.used,
        totalCapacity: usage.total,
        percentUsed: usage.percentage.toFixed(2) + '%'
      });
    } else {
      console.log('[StartupRecovery] ⊘ No watermark found (wallet may not be initialized)');
    }
  } catch (error: any) {
    const errorMsg = `Failed to load watermark: ${error.message}`;
    report.errors.push(errorMsg);
    console.error('[StartupRecovery]', errorMsg);
  }

  try {
    await leaseStore.load();
    const allLeases = leaseStore.getAll();
    report.leasesRehydrated = allLeases.length;

    console.log(`[StartupRecovery] Rehydrated ${allLeases.length} leases from storage`);

    const expiredCount = await leaseStore.cleanupExpired();
    report.expiredLeasesClean = expiredCount;

    if (expiredCount > 0) {
      console.log(`[StartupRecovery] ✓ Cleaned up ${expiredCount} expired leases`);
    }

    const activeLeases = leaseStore.getActive();
    report.activeLeasesRecovered = activeLeases.length;

    if (activeLeases.length > 0) {
      console.log(`[StartupRecovery] ⚠ Recovered ${activeLeases.length} active leases:`);
      activeLeases.forEach(lease => {
        const remainingMs = lease.expiresAt - Date.now();
        console.log(`  - Lease ${lease.leaseId}: ${Math.round(remainingMs / 1000)}s remaining`);
      });
      
      console.warn('[StartupRecovery] Active leases may have been in-flight during crash. UI should detect and allow retry.');
    } else {
      console.log('[StartupRecovery] ✓ No active leases to recover');
    }
  } catch (error: any) {
    const errorMsg = `Failed to rehydrate leases: ${error.message}`;
    report.errors.push(errorMsg);
    console.error('[StartupRecovery]', errorMsg);
  }

  if (report.errors.length === 0) {
    console.log('[StartupRecovery] ✅ Recovery complete:', {
      watermark: report.watermarkLoaded ? 'loaded' : 'none',
      leases: `${report.leasesRehydrated} total, ${report.activeLeasesRecovered} active, ${report.expiredLeasesClean} cleaned`
    });
  } else {
    console.error('[StartupRecovery] ⚠ Recovery completed with errors:', report.errors);
  }

  return report;
}

export async function getRecoveryStatus(): Promise<RecoveryReport | null> {
  try {
    const result = await chrome.storage.local.get('totem_last_recovery');
    return result.totem_last_recovery || null;
  } catch (error) {
    console.error('[StartupRecovery] Failed to get recovery status:', error);
    return null;
  }
}

export async function saveRecoveryStatus(report: RecoveryReport): Promise<void> {
  try {
    await chrome.storage.local.set({
      totem_last_recovery: report
    });
  } catch (error) {
    console.error('[StartupRecovery] Failed to save recovery status:', error);
  }
}
