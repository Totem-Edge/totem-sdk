/**
 * WatermarkStore - Per-Address WOTS Index Tracking
 * 
 * Updated 2026-02-05 for Per-Address TreeKey Architecture:
 * - Each address (0-63) has its own TreeKey with independent (l1, l2) indices
 * - Total capacity: 64 addresses × 64 × 64 = 262,144 one-time signatures
 * - Signing path: Root → L1 → DATA (2 proofs per signature)
 * 
 * Security invariants:
 * - Watermarks MUST advance monotonically (never decrease)
 * - Legacy format detection blocks signing until explicit migration
 * - Storage corruption is detected via validation on load
 */

import {
  classifyCapacity,
  SIGNATURE_CAPACITY_PER_ADDRESS,
  SignatureCapacity,
} from './signatureCapacity';

export interface PerAddressIndices {
  l1: number;
  l2: number;
}

export interface SigningIndices {
  addressIndex: number;
  l1: number;
  l2: number;
}

/** @deprecated Use SigningIndices instead */
export interface WotsIndices {
  l1: number;
  l2: number;
  l3: number;
}

export interface AddressWatermark {
  next_l1: number;
  next_l2: number;
  usedIndices: Array<[number, number]>;
}

export interface WatermarkState {
  version: 2;
  addresses: { [addressIndex: number]: AddressWatermark };
  lastSyncTimestamp?: number;
}

/** @deprecated */
export interface LegacyWatermarkState {
  version?: 1;
  next_l1: number;
  next_l2: number;
  next_l3: number;
  usedIndices: Array<[number, number, number]>;
  lastSyncTimestamp?: number;
  serverWatermark?: WotsIndices;
}

const STORAGE_KEY = 'totem_wots_watermark';

export class WatermarkStore {
  private state: WatermarkState | null = null;
  private _legacyDetected = false;

  async load(): Promise<WatermarkState | null> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      if (result[STORAGE_KEY]) {
        const stored = result[STORAGE_KEY];

        if (!stored.version || stored.version === 1 || stored.next_l1 !== undefined) {
          console.warn('[WatermarkStore] Legacy v1 format detected — signing blocked until migration');
          this._legacyDetected = true;
          return null;
        }

        const validated = stored as WatermarkState;
        if (!this.validateState(validated)) {
          console.error('[WatermarkStore] Stored state failed validation — treating as corrupted');
          this._legacyDetected = true;
          return null;
        }

        this.state = validated;
        return this.state;
      }
      return null;
    } catch (error) {
      console.error('[WatermarkStore] Failed to load watermark:', error);
      return null;
    }
  }

  private validateState(state: WatermarkState): boolean {
    if (state.version !== 2) return false;
    if (!state.addresses || typeof state.addresses !== 'object') return false;

    for (const key of Object.keys(state.addresses)) {
      const idx = Number(key);
      if (isNaN(idx) || idx < 0 || idx >= 64) return false;

      const aw = state.addresses[idx];
      if (!aw) continue;
      if (typeof aw.next_l1 !== 'number' || typeof aw.next_l2 !== 'number') return false;
      if (aw.next_l1 < 0 || aw.next_l1 > 64) return false;
      if (aw.next_l2 < 0 || aw.next_l2 >= 64 && aw.next_l1 < 64) return false;
      if (!Array.isArray(aw.usedIndices)) return false;
    }
    return true;
  }

  async save(watermark: WatermarkState): Promise<void> {
    if (this.state) {
      for (const key of Object.keys(watermark.addresses)) {
        const idx = Number(key);
        const prev = this.state.addresses[idx];
        const next = watermark.addresses[idx];
        if (prev && next) {
          const prevFlat = this.flattenPerAddressIndex(prev.next_l1, prev.next_l2);
          const nextFlat = this.flattenPerAddressIndex(next.next_l1, next.next_l2);
          if (nextFlat < prevFlat) {
            throw new Error(
              `WatermarkStore: monotonicity violation for address ${idx} — ` +
              `cannot decrease from (${prev.next_l1},${prev.next_l2}) to (${next.next_l1},${next.next_l2})`
            );
          }
        }
      }
    }

    try {
      this.state = watermark;
      await chrome.storage.local.set({
        [STORAGE_KEY]: watermark
      });
    } catch (error) {
      console.error('[WatermarkStore] Failed to save watermark:', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      this.state = null;
      this._legacyDetected = false;
      await chrome.storage.local.remove(STORAGE_KEY);
    } catch (error) {
      console.error('[WatermarkStore] Failed to clear watermark:', error);
      throw error;
    }
  }

  getCurrent(): WatermarkState | null {
    return this.state;
  }

  isLegacyBlocked(): boolean {
    return this._legacyDetected;
  }

  async initialize(): Promise<WatermarkState> {
    const existing = await this.load();
    if (existing) {
      return existing;
    }

    if (this._legacyDetected) {
      throw new Error(
        'WatermarkStore: legacy v1 format detected. ' +
        'Call migrateLegacy() to safely migrate before signing.'
      );
    }

    const initialState: WatermarkState = {
      version: 2,
      addresses: {}
    };

    for (let i = 0; i < 64; i++) {
      initialState.addresses[i] = {
        next_l1: 0,
        next_l2: 0,
        usedIndices: []
      };
    }

    await this.save(initialState);
    return initialState;
  }

  async migrateLegacy(): Promise<WatermarkState> {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY];

    if (!stored || (stored.version === 2 && stored.addresses)) {
      this._legacyDetected = false;
      if (stored) {
        this.state = stored as WatermarkState;
        return this.state;
      }
      return this.initialize();
    }

    const legacy = stored as LegacyWatermarkState;
    console.log('[WatermarkStore] Migrating legacy v1 → v2');

    const migratedState: WatermarkState = {
      version: 2,
      addresses: {}
    };

    for (let i = 0; i < 64; i++) {
      migratedState.addresses[i] = {
        next_l1: 0,
        next_l2: 0,
        usedIndices: []
      };
    }

    if (legacy.usedIndices && legacy.usedIndices.length > 0) {
      for (const [l1, l2, l3] of legacy.usedIndices) {
        const addressIndex = l1;
        if (addressIndex >= 0 && addressIndex < 64) {
          const addr = migratedState.addresses[addressIndex];
          addr.usedIndices.push([l2, l3]);

          const usedFlat = l2 * 64 + l3;
          const currentFlat = addr.next_l1 * 64 + addr.next_l2;
          if (usedFlat >= currentFlat) {
            const nextIndices = this.calculateNextPerAddressIndices({ l1: l2, l2: l3 });
            addr.next_l1 = nextIndices.l1;
            addr.next_l2 = nextIndices.l2;
          }
        }
      }
    }

    this.state = null;
    this._legacyDetected = false;
    await this.save(migratedState);
    console.log('[WatermarkStore] Migration complete');
    return migratedState;
  }

  private getOrCreateAddressWatermark(addressIndex: number): AddressWatermark {
    if (!this.state) {
      throw new Error('Watermark not initialized');
    }
    
    if (!this.state.addresses[addressIndex]) {
      this.state.addresses[addressIndex] = {
        next_l1: 0,
        next_l2: 0,
        usedIndices: []
      };
    }
    
    return this.state.addresses[addressIndex];
  }

  async markUsed(indices: SigningIndices): Promise<void> {
    if (!this.state) {
      await this.load();
    }

    if (!this.state) {
      throw new Error('Watermark not initialized');
    }

    if (this._legacyDetected) {
      throw new Error('Signing blocked: legacy watermark format requires migration');
    }

    const addrWm = this.getOrCreateAddressWatermark(indices.addressIndex);
    
    const alreadyUsed = addrWm.usedIndices.some(([l1, l2]) => 
      l1 === indices.l1 && l2 === indices.l2
    );
    
    if (!alreadyUsed) {
      addrWm.usedIndices.push([indices.l1, indices.l2]);
    } else {
      console.warn(`[WatermarkStore] Indices already used: address=${indices.addressIndex}, (l1=${indices.l1}, l2=${indices.l2})`);
    }

    await this.save(this.state);
  }

  async advanceWatermark(indices: SigningIndices): Promise<void> {
    if (!this.state) {
      await this.load();
    }

    if (!this.state) {
      throw new Error('Watermark not initialized');
    }

    if (this._legacyDetected) {
      throw new Error('Signing blocked: legacy watermark format requires migration');
    }

    const addrWm = this.getOrCreateAddressWatermark(indices.addressIndex);
    const nextIndices = this.calculateNextPerAddressIndices({ l1: indices.l1, l2: indices.l2 });
    
    addrWm.next_l1 = nextIndices.l1;
    addrWm.next_l2 = nextIndices.l2;

    await this.save(this.state);
  }

  private calculateNextPerAddressIndices(current: PerAddressIndices): PerAddressIndices {
    let { l1, l2 } = current;

    l2++;
    if (l2 >= 64) {
      l2 = 0;
      l1++;
    }

    return { l1, l2 };
  }

  isAddressExhausted(addressIndex: number): boolean {
    if (!this.state) return false;
    const addrWm = this.state.addresses[addressIndex];
    if (!addrWm) return false;
    return addrWm.next_l1 >= 64;
  }

  hasAvailableIndices(): boolean {
    if (!this.state) return false;
    
    for (let i = 0; i < 64; i++) {
      if (!this.isAddressExhausted(i)) {
        return true;
      }
    }
    return false;
  }

  getNextIndicesForAddress(addressIndex: number): SigningIndices | null {
    if (!this.state || this.isAddressExhausted(addressIndex)) {
      return null;
    }

    const addrWm = this.getOrCreateAddressWatermark(addressIndex);
    
    return {
      addressIndex,
      l1: addrWm.next_l1,
      l2: addrWm.next_l2
    };
  }

  /**
   * Returns the signing capacity for a single address based on the current
   * watermark position. The watermark counts every leaf consumed for either
   * verify (auth) or spend signatures, so this is the authoritative measure
   * of how much of the address's one-time signature budget has been used.
   */
  getAddressCapacity(addressIndex: number): SignatureCapacity {
    if (!this.state) {
      return classifyCapacity(0, SIGNATURE_CAPACITY_PER_ADDRESS);
    }
    const addrWm = this.state.addresses[addressIndex];
    if (!addrWm) {
      return classifyCapacity(0, SIGNATURE_CAPACITY_PER_ADDRESS);
    }
    const used = addrWm.next_l1 * 64 + addrWm.next_l2;
    return classifyCapacity(used, SIGNATURE_CAPACITY_PER_ADDRESS);
  }

  getAddressUsage(addressIndex: number): { used: number; total: number; percentage: number } {
    if (!this.state) {
      return { used: 0, total: 4096, percentage: 0 };
    }
    
    const addrWm = this.state.addresses[addressIndex];
    const used = addrWm ? addrWm.usedIndices.length : 0;
    const total = 64 * 64;
    
    return {
      used,
      total,
      percentage: (used / total) * 100
    };
  }

  getTotalUsage(): { used: number; total: number; percentage: number } {
    if (!this.state) {
      return { used: 0, total: 262144, percentage: 0 };
    }
    
    let totalUsed = 0;
    for (let i = 0; i < 64; i++) {
      const addrWm = this.state.addresses[i];
      if (addrWm) {
        totalUsed += addrWm.next_l1 * 64 + addrWm.next_l2;
      }
    }
    
    const total = 64 * 64 * 64;
    return {
      used: totalUsed,
      total,
      percentage: (totalUsed / total) * 100
    };
  }

  private flattenPerAddressIndex(l1: number, l2: number): number {
    return (l1 * 64) + l2;
  }

  /** @deprecated For migration use only */
  static convertLegacyIndices(legacy: WotsIndices): SigningIndices {
    return {
      addressIndex: legacy.l1,
      l1: legacy.l2,
      l2: legacy.l3
    };
  }

  async isLegacyFormat(): Promise<boolean> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      if (!result[STORAGE_KEY]) return false;
      
      const stored = result[STORAGE_KEY];
      return !stored.version || stored.version === 1 || stored.next_l1 !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Restore watermark from a server-side (l1, l2, l3) watermark after extension reinstall.
   *
   * The server stores the old 3-level format where:
   *   l1 = address index that was last used
   *   l2 = per-address next_l1 (TreeKey L1 within that address)
   *   l3 = per-address next_l2 (TreeKey L2 within that address)
   *
   * Reconstruction logic:
   *   - Addresses 0 … l1-1  → exhausted: next_l1=64, next_l2=0
   *   - Address  l1         → in progress: next_l1=l2, next_l2=l3
   *   - Addresses l1+1 … 63 → untouched: next_l1=0, next_l2=0
   */
  async restoreFromServer(l1: number, l2: number, l3: number): Promise<WatermarkState> {
    const restoredState: WatermarkState = {
      version: 2,
      addresses: {},
      lastSyncTimestamp: Date.now()
    };

    for (let i = 0; i < 64; i++) {
      if (i < l1) {
        restoredState.addresses[i] = { next_l1: 64, next_l2: 0, usedIndices: [] };
      } else if (i === l1) {
        restoredState.addresses[i] = { next_l1: l2, next_l2: l3, usedIndices: [] };
      } else {
        restoredState.addresses[i] = { next_l1: 0, next_l2: 0, usedIndices: [] };
      }
    }

    this.state = null;
    await chrome.storage.local.set({ [STORAGE_KEY]: restoredState });
    this.state = restoredState;

    console.log(`[WatermarkStore] Restored from server watermark (l1=${l1}, l2=${l2}, l3=${l3})`);
    return restoredState;
  }
}

export const watermarkStore = new WatermarkStore();
