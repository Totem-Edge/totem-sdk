/**
 * Watermark Sync Utilities
 *
 * Synchronizes local watermark with Axia API server watermark.
 * Ensures multi-device safety and prevents WOTS index reuse.
 *
 * Per-Address TreeKey Architecture (2026-02-05):
 * - Each of the 64 addresses has its own (next_l1, next_l2) watermark.
 * - On fresh install the chrome.storage is empty; we fetch from the server
 *   before initialising to zeros so no previously-used slot is re-issued.
 */

import { watermarkStore } from '../stores';
import type { SigningIndices } from '../stores/WatermarkStore';

export interface WatermarkSyncResult {
  synced: boolean;
  updated: boolean;
  restoredFromServer?: boolean;
  totalUsage: { used: number; total: number; percentage: number };
  multiDeviceConflict?: boolean;
  drift?: number;
}

/**
 * Sync watermark state.
 *
 * @param rootPublicKey  - The wallet's root public key (used for logging only;
 *                         actual server fetch is delegated to fetchFromServer).
 * @param fetchFromServer - Optional async callback that fetches the server
 *                         watermark `{l1, l2, l3}` for this wallet.  When the
 *                         local store is empty and this callback is provided,
 *                         the result is used to restore the local watermark
 *                         before falling back to zero-initialisation.
 */
export async function syncWatermark(
  rootPublicKey: string,
  fetchFromServer?: () => Promise<{ l1: number; l2: number; l3: number } | null>
): Promise<WatermarkSyncResult> {
  console.log('[WatermarkSync] Loading local watermark state for key:', rootPublicKey?.slice(0, 20) + '...');

  try {
    await watermarkStore.load();
    let localState = watermarkStore.getCurrent();
    let restoredFromServer = false;

    if (!localState) {
      // Local store is empty — this is either a fresh install or reinstall.
      // Try the server first so we never reuse slots that were consumed in a
      // previous install of the same wallet.
      if (fetchFromServer) {
        try {
          const serverWm = await fetchFromServer();
          if (serverWm && (serverWm.l1 > 0 || serverWm.l2 > 0 || serverWm.l3 > 0)) {
            console.log(`[WatermarkSync] Restoring from server watermark: (l1=${serverWm.l1}, l2=${serverWm.l2}, l3=${serverWm.l3})`);
            await watermarkStore.restoreFromServer(serverWm.l1, serverWm.l2, serverWm.l3);
            localState = watermarkStore.getCurrent();
            restoredFromServer = true;
          } else {
            console.log('[WatermarkSync] Server watermark is zero — initialising fresh local state');
            await watermarkStore.initialize();
          }
        } catch (serverErr: any) {
          console.warn('[WatermarkSync] Server fetch failed, initialising fresh local state:', serverErr.message);
          await watermarkStore.initialize();
        }
      } else {
        await watermarkStore.initialize();
      }
    }

    const totalUsage = watermarkStore.getTotalUsage();

    console.log('[WatermarkSync] ✓ Watermark state ready:', {
      restoredFromServer,
      totalUsed: totalUsage.used,
      totalAvailable: totalUsage.total,
      percentUsed: totalUsage.percentage.toFixed(2) + '%'
    });

    return {
      synced: true,
      updated: restoredFromServer,
      restoredFromServer,
      totalUsage
    };

  } catch (error: any) {
    console.error('[WatermarkSync] Failed to sync watermark:', error.message);
    throw error;
  }
}

export async function getWatermarkSyncStatus(): Promise<{
  lastSync: number | undefined;
  needsSync: boolean;
  minutesSinceSync: number | null;
}> {
  const state = watermarkStore.getCurrent();
  
  if (!state || !state.lastSyncTimestamp) {
    return {
      lastSync: undefined,
      needsSync: true,
      minutesSinceSync: null
    };
  }

  const minutesSinceSync = (Date.now() - state.lastSyncTimestamp) / 1000 / 60;
  const needsSync = minutesSinceSync > 5;

  return {
    lastSync: state.lastSyncTimestamp,
    needsSync,
    minutesSinceSync
  };
}

/**
 * Get next available signing indices for a specific address
 */
export function getNextIndicesForAddress(addressIndex: number): SigningIndices | null {
  return watermarkStore.getNextIndicesForAddress(addressIndex);
}
