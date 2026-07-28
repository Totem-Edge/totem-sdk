/**
 * @module WatermarkStore
 * WOTS index tracking with server synchronization
 * 
 * Uses in-memory cache backed by persistent storage.
 * Pattern:
 * - initialize() loads from storage into memory cache (or creates default)
 * - Sync getters read from memory cache (fast, no I/O)
 * - Mutators update memory cache AND persist to storage
 * - Caller MUST call initialize() before using sync getters
 */

import type { StorageAdapter, LoggerAdapter } from '../adapters/index.js';
import { NoopLogger } from '../adapters/index.js';

export interface WotsIndices {
  addressIndex: number;
  l1: number;
  l2: number;
}

export interface WatermarkState {
  next_addressIndex: number;
  next_l1: number;
  next_l2: number;
  usedIndices: Array<[number, number, number]>;
  lastSyncTimestamp?: number;
  serverWatermark?: WotsIndices;
}

export interface SyncResult {
  updated: boolean;
  drift: number;
  hasConflict: boolean;
}

export interface WatermarkStoreConfig {
  storageKey?: string;
}

const DEFAULT_STORAGE_KEY = 'totem_wots_watermark';
const MAX_INDEX_PER_LEVEL = 64;
const TOTAL_INDICES = 64 * 64 * 64;

export class WatermarkStore {
  private state: WatermarkState | null = null;
  private _initialized = false;
  private readonly storageKey: string;
  private readonly storage: StorageAdapter;
  private readonly logger: LoggerAdapter;

  constructor(
    storage: StorageAdapter,
    logger: LoggerAdapter = new NoopLogger(),
    config: WatermarkStoreConfig = {}
  ) {
    this.storage = storage;
    this.logger = logger;
    this.storageKey = config.storageKey ?? DEFAULT_STORAGE_KEY;
  }

  async initialize(): Promise<WatermarkState> {
    if (this._initialized && this.state) {
      return this.state;
    }

    const existing = await this.load();
    if (existing) {
      this._initialized = true;
      return existing;
    }

    const initialState: WatermarkState = {
      next_addressIndex: 0,
      next_l1: 0,
      next_l2: 0,
      usedIndices: []
    };

    await this.save(initialState);
    this._initialized = true;
    return initialState;
  }

  isInitialized(): boolean {
    return this._initialized;
  }

  async load(): Promise<WatermarkState | null> {
    try {
      const watermark = await this.storage.get<WatermarkState>(this.storageKey);
      if (watermark) {
        this.state = watermark;
        this.logger.debug('Loaded watermark from storage');
        return this.state;
      }
      return null;
    } catch (error) {
      this.logger.error('Failed to load watermark:', error);
      return null;
    }
  }

  async save(watermark: WatermarkState): Promise<void> {
    try {
      this.state = watermark;
      await this.storage.set(this.storageKey, watermark);
    } catch (error) {
      this.logger.error('Failed to save watermark:', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      this.state = null;
      this._initialized = false;
      await this.storage.remove(this.storageKey);
      this.logger.debug('Cleared watermark');
    } catch (error) {
      this.logger.error('Failed to clear watermark:', error);
      throw error;
    }
  }

  getCurrent(): WatermarkState | null {
    return this.state;
  }

  getNextIndices(): WotsIndices | null {
    if (!this.state || this.isExhausted()) {
      return null;
    }

    return {
      addressIndex: this.state.next_addressIndex,
      l1: this.state.next_l1,
      l2: this.state.next_l2
    };
  }

  isExhausted(): boolean {
    if (!this.state) return false;
    return this.state.next_addressIndex >= MAX_INDEX_PER_LEVEL;
  }

  hasAvailableIndices(): boolean {
    return !this.isExhausted();
  }

  async markUsed(indices: WotsIndices): Promise<void> {
    if (!this.state) {
      await this.load();
    }

    if (!this.state) {
      throw new Error('Watermark not initialized');
    }

    const indexTuple: [number, number, number] = [indices.addressIndex, indices.l1, indices.l2];
    const flatIndex = this.flattenIndex(indices.addressIndex, indices.l1, indices.l2);
    
    const alreadyUsed = this.state.usedIndices.some(([addressIndex, l1, l2]) => 
      addressIndex === indices.addressIndex && l1 === indices.l1 && l2 === indices.l2
    );
    
    if (!alreadyUsed) {
      this.logger.debug(`Marking indices as USED: (addressIndex=${indices.addressIndex}, l1=${indices.l1}, l2=${indices.l2}) [${flatIndex}/${TOTAL_INDICES}]`);
      this.logger.debug(`  total used: ${this.state.usedIndices.length + 1} / ${TOTAL_INDICES}`);
      this.state.usedIndices.push(indexTuple);
    } else {
      this.logger.warn(`Indices already marked as used: (addressIndex=${indices.addressIndex}, l1=${indices.l1}, l2=${indices.l2})`);
    }

    await this.save(this.state);
  }

  async advanceWatermark(indices: WotsIndices): Promise<void> {
    if (!this.state) {
      await this.load();
    }

    if (!this.state) {
      throw new Error('Watermark not initialized');
    }

    const currentFlat = this.flattenIndex(indices.addressIndex, indices.l1, indices.l2);
    const nextIndices = this.calculateNextIndices(indices);
    const nextFlat = this.flattenIndex(nextIndices.addressIndex, nextIndices.l1, nextIndices.l2);
    
    this.logger.debug(`Advancing watermark...`);
    this.logger.debug(`  current: (addressIndex=${indices.addressIndex}, l1=${indices.l1}, l2=${indices.l2}) [${currentFlat}/${TOTAL_INDICES}]`);
    this.logger.debug(`  next:    (addressIndex=${nextIndices.addressIndex}, l1=${nextIndices.l1}, l2=${nextIndices.l2}) [${nextFlat}/${TOTAL_INDICES}]`);
    
    this.state.next_addressIndex = nextIndices.addressIndex;
    this.state.next_l1 = nextIndices.l1;
    this.state.next_l2 = nextIndices.l2;

    await this.save(this.state);
    this.logger.debug('Watermark advanced and persisted');
  }

  async updateFromServer(serverWatermark: WotsIndices): Promise<SyncResult> {
    if (!this.state) {
      await this.load();
    }

    if (!this.state) {
      await this.initialize();
    }

    const localIndexFlat = this.flattenIndex(this.state!.next_addressIndex, this.state!.next_l1, this.state!.next_l2);
    const serverIndexFlat = this.flattenIndex(serverWatermark.addressIndex, serverWatermark.l1, serverWatermark.l2);
    const drift = serverIndexFlat - localIndexFlat;
    const hasConflict = drift > 1;

    const needsUpdate = this.shouldUseServerWatermark(this.state!, serverWatermark);

    if (needsUpdate) {
      this.logger.debug(`Updating watermark from server (drift: ${drift})`);
      this.state!.next_addressIndex = serverWatermark.addressIndex;
      this.state!.next_l1 = serverWatermark.l1;
      this.state!.next_l2 = serverWatermark.l2;
      this.state!.serverWatermark = serverWatermark;
      this.state!.lastSyncTimestamp = Date.now();
      await this.save(this.state!);
      return { updated: true, drift, hasConflict };
    }

    this.state!.lastSyncTimestamp = Date.now();
    await this.save(this.state!);
    return { updated: false, drift, hasConflict };
  }

  getUsageStats(): { used: number; total: number; percentage: number } {
    const used = this.state?.usedIndices.length ?? 0;
    return {
      used,
      total: TOTAL_INDICES,
      percentage: (used / TOTAL_INDICES) * 100
    };
  }

  private calculateNextIndices(current: WotsIndices): WotsIndices {
    let { addressIndex, l1, l2 } = current;

    l2++;
    if (l2 >= MAX_INDEX_PER_LEVEL) {
      l2 = 0;
      l1++;
      if (l1 >= MAX_INDEX_PER_LEVEL) {
        l1 = 0;
        addressIndex++;
      }
    }

    return { addressIndex, l1, l2 };
  }

  private shouldUseServerWatermark(local: WatermarkState, server: WotsIndices): boolean {
    if (server.addressIndex > local.next_addressIndex) return true;
    if (server.addressIndex === local.next_addressIndex && server.l1 > local.next_l1) return true;
    if (server.addressIndex === local.next_addressIndex && server.l1 === local.next_l1 && server.l2 > local.next_l2) return true;
    return false;
  }

  private flattenIndex(addressIndex: number, l1: number, l2: number): number {
    return (addressIndex * MAX_INDEX_PER_LEVEL * MAX_INDEX_PER_LEVEL) + (l1 * MAX_INDEX_PER_LEVEL) + l2;
  }
}
