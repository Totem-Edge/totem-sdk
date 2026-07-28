/**
 * SDK Wallet Initialization
 * 
 * Bridges Totem extension with SDK-style modules.
 * Provides SDK-based initialization of LeaseStore, WatermarkStore,
 * and other core services using platform-agnostic adapters.
 * 
 * This module is used when walletInitMode === 'sdk' to enable
 * the migrated SDK code path for wallet initialization.
 */

import { watermarkStore as legacyWatermarkStore, leaseStore as legacyLeaseStore } from '../stores';
import { leaseMonitor as legacyLeaseMonitor } from '../monitoring/lease';

export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

export interface LoggerAdapter {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface TimerAdapter {
  setTimeout(callback: () => void, ms: number): number;
  clearTimeout(id: number): void;
  setInterval(callback: () => void, ms: number): number;
  clearInterval(id: number): void;
  now(): number;
}

export interface AdapterRegistry {
  storage: StorageAdapter;
  logger: LoggerAdapter;
  timer: TimerAdapter;
}

export interface SdkWalletConfig {
  publicKey: string;
  projectId: string;
  adapters: AdapterRegistry;
}

export interface SdkInitResult {
  recoveryReport: {
    watermarkLoaded: boolean;
    leasesRehydrated: number;
    expiredLeasesCleaned: number;
    activeLeasesRecovered: number;
  };
}

export async function initSdkWallet(config: SdkWalletConfig): Promise<SdkInitResult> {
  const { publicKey, adapters } = config;
  const { logger } = adapters;

  logger.info('[SdkWalletInit] Starting SDK-based wallet initialization...');

  const recoveryReport = {
    watermarkLoaded: false,
    leasesRehydrated: 0,
    expiredLeasesCleaned: 0,
    activeLeasesRecovered: 0,
  };

  try {
    await legacyWatermarkStore.load();
    const watermarkState = legacyWatermarkStore.getCurrent();
    
    if (watermarkState) {
      recoveryReport.watermarkLoaded = true;
      const usage = legacyWatermarkStore.getTotalUsage();
      logger.info('[SdkWalletInit] Watermark loaded:', {
        version: watermarkState.version,
        totalUsed: usage.used,
        totalCapacity: usage.total,
        percentUsed: usage.percentage.toFixed(2) + '%',
      });
    } else {
      logger.info('[SdkWalletInit] No watermark found (wallet may not be initialized)');
    }
  } catch (error) {
    logger.error('[SdkWalletInit] Failed to load watermark:', error);
  }

  try {
    await legacyLeaseStore.load();
    const allLeases = legacyLeaseStore.getAll();
    recoveryReport.leasesRehydrated = allLeases.length;

    logger.info(`[SdkWalletInit] Rehydrated ${allLeases.length} leases from storage`);

    const cleanupCount = await legacyLeaseStore.cleanupExpired();
    recoveryReport.expiredLeasesCleaned = cleanupCount;

    if (cleanupCount > 0) {
      logger.info(`[SdkWalletInit] Cleaned up ${cleanupCount} expired leases`);
    }

    const activeLeases = legacyLeaseStore.getActive();
    recoveryReport.activeLeasesRecovered = activeLeases.length;

    if (activeLeases.length > 0) {
      logger.warn(`[SdkWalletInit] Recovered ${activeLeases.length} active leases`);
    }
  } catch (error) {
    logger.error('[SdkWalletInit] Failed to rehydrate leases:', error);
  }

  legacyLeaseMonitor.start();

  legacyLeaseMonitor.onExpiry((event) => {
    logger.warn('[SdkWalletInit] Lease expiring soon:', {
      leaseId: event.leaseId,
      remainingSeconds: Math.round(event.remainingMs / 1000),
    });
  });

  logger.info('[SdkWalletInit] SDK wallet initialization complete');

  return {
    recoveryReport,
  };
}

export class ChromeStorageAdapter implements StorageAdapter {
  private prefix: string;

  constructor(options: { prefix?: string } = {}) {
    this.prefix = options.prefix || 'totem_';
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.getKey(key);
      const result = await chrome.storage.local.get(fullKey);
      return result[fullKey] ?? null;
    } catch (error) {
      console.error(`[ChromeStorageAdapter] Failed to get ${key}:`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const fullKey = this.getKey(key);
      await chrome.storage.local.set({ [fullKey]: value });
    } catch (error) {
      console.error(`[ChromeStorageAdapter] Failed to set ${key}:`, error);
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      const fullKey = this.getKey(key);
      await chrome.storage.local.remove(fullKey);
    } catch (error) {
      console.error(`[ChromeStorageAdapter] Failed to remove ${key}:`, error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      const allItems: Record<string, unknown> = await new Promise((resolve) => {
        chrome.storage.local.get(null, (items) => resolve(items || {}));
      });
      const keysToRemove = Object.keys(allItems).filter(k => k.startsWith(this.prefix));
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
      }
    } catch (error) {
      console.error('[ChromeStorageAdapter] Failed to clear:', error);
      throw error;
    }
  }

  async keys(): Promise<string[]> {
    try {
      const allItems: Record<string, unknown> = await new Promise((resolve) => {
        chrome.storage.local.get(null, (items) => resolve(items || {}));
      });
      return Object.keys(allItems)
        .filter(k => k.startsWith(this.prefix))
        .map(k => k.slice(this.prefix.length));
    } catch (error) {
      console.error('[ChromeStorageAdapter] Failed to get keys:', error);
      return [];
    }
  }
}

export class ExtensionLoggerAdapter implements LoggerAdapter {
  private prefix: string;

  constructor(prefix: string = '[TotemSDK]') {
    this.prefix = prefix;
  }

  debug(message: string, ...args: unknown[]): void {
    console.debug(`${this.prefix} ${message}`, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    console.log(`${this.prefix} ${message}`, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(`${this.prefix} ${message}`, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(`${this.prefix} ${message}`, ...args);
  }
}

export class ExtensionTimerAdapter implements TimerAdapter {
  setTimeout(callback: () => void, ms: number): number {
    return globalThis.setTimeout(callback, ms) as unknown as number;
  }

  clearTimeout(id: number): void {
    globalThis.clearTimeout(id);
  }

  setInterval(callback: () => void, ms: number): number {
    return globalThis.setInterval(callback, ms) as unknown as number;
  }

  clearInterval(id: number): void {
    globalThis.clearInterval(id);
  }

  now(): number {
    return Date.now();
  }
}

export function createExtensionAdapters(projectId: string): AdapterRegistry {
  const storage = new ChromeStorageAdapter({ prefix: `totem_${projectId}_` });
  const logger = new ExtensionLoggerAdapter('[TotemSDK]');
  const timer = new ExtensionTimerAdapter();

  return {
    storage,
    logger,
    timer,
  };
}
