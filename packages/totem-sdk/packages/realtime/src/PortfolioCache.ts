/**
 * Portfolio Cache
 *
 * Platform-agnostic persistent storage for PortfolioEntry[] per address.
 * Uses injected StorageAdapter for platform independence.
 */

import type { StorageAdapter, LoggerAdapter } from '@totemsdk/core';
import type { PortfolioEntry } from './types.js';

const CACHE_PREFIX = 'portfolio_cache_';
const DEFAULT_MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours

export interface PortfolioCacheConfig {
  maxCacheAge?: number;
}

export interface PortfolioCacheDependencies {
  storage: StorageAdapter;
  logger: LoggerAdapter;
  timer: { now(): number };
}

interface CacheEntry {
  entries: PortfolioEntry[];
  timestamp: number;
}

export class PortfolioCache {
  private readonly storage: StorageAdapter;
  private readonly logger: LoggerAdapter;
  private readonly timer: { now(): number };
  private readonly maxCacheAge: number;
  private inMemoryCache: Map<string, CacheEntry> = new Map();

  constructor(
    deps: PortfolioCacheDependencies,
    config: PortfolioCacheConfig = {}
  ) {
    this.storage = deps.storage;
    this.logger = deps.logger;
    this.timer = deps.timer;
    this.maxCacheAge = config.maxCacheAge ?? DEFAULT_MAX_CACHE_AGE;
  }

  async get(address: string): Promise<PortfolioEntry[] | null> {
    try {
      if (this.inMemoryCache.has(address)) {
        const cached = this.inMemoryCache.get(address)!;
        if (this.timer.now() - cached.timestamp <= this.maxCacheAge) {
          return cached.entries;
        }
        this.inMemoryCache.delete(address);
      }

      const key = CACHE_PREFIX + address;
      const cached = await this.storage.get<CacheEntry>(key);

      if (!cached) return null;

      if (this.timer.now() - cached.timestamp > this.maxCacheAge) {
        await this.remove(address);
        return null;
      }

      this.inMemoryCache.set(address, cached);
      return cached.entries;
    } catch (error) {
      this.logger.error('[PortfolioCache] Failed to get:', error);
      return null;
    }
  }

  async set(address: string, entries: PortfolioEntry[]): Promise<void> {
    try {
      const entry: CacheEntry = { entries, timestamp: this.timer.now() };
      this.inMemoryCache.set(address, entry);

      const key = CACHE_PREFIX + address;
      await this.storage.set(key, entry);
    } catch (error) {
      this.logger.error('[PortfolioCache] Failed to set:', error);
    }
  }

  async remove(address: string): Promise<void> {
    try {
      this.inMemoryCache.delete(address);

      const key = CACHE_PREFIX + address;
      await this.storage.remove(key);
    } catch (error) {
      this.logger.error('[PortfolioCache] Failed to remove:', error);
    }
  }

  async getAll(): Promise<Record<string, PortfolioEntry[]>> {
    try {
      const allKeys = await this.storage.keys?.() ?? [];
      const result: Record<string, PortfolioEntry[]> = {};
      const now = this.timer.now();

      for (const key of allKeys) {
        if (key.startsWith(CACHE_PREFIX)) {
          const cached = await this.storage.get<CacheEntry>(key);
          if (cached && now - cached.timestamp <= this.maxCacheAge) {
            const address = key.substring(CACHE_PREFIX.length);
            result[address] = cached.entries;
          }
        }
      }

      return result;
    } catch (error) {
      this.logger.error('[PortfolioCache] Failed to getAll:', error);
      return {};
    }
  }

  async clear(): Promise<void> {
    try {
      this.inMemoryCache.clear();

      const allKeys = await this.storage.keys?.() ?? [];
      for (const key of allKeys) {
        if (key.startsWith(CACHE_PREFIX)) {
          await this.storage.remove(key);
        }
      }
    } catch (error) {
      this.logger.error('[PortfolioCache] Failed to clear:', error);
    }
  }

  async cleanup(): Promise<number> {
    try {
      const allKeys = await this.storage.keys?.() ?? [];
      let removed = 0;
      const now = this.timer.now();

      for (const key of allKeys) {
        if (key.startsWith(CACHE_PREFIX)) {
          const cached = await this.storage.get<CacheEntry>(key);
          if (cached && now - cached.timestamp > this.maxCacheAge) {
            await this.storage.remove(key);
            removed++;
          }
        }
      }

      for (const [address, cached] of this.inMemoryCache.entries()) {
        if (now - cached.timestamp > this.maxCacheAge) {
          this.inMemoryCache.delete(address);
        }
      }

      return removed;
    } catch (error) {
      this.logger.error('[PortfolioCache] Failed to cleanup:', error);
      return 0;
    }
  }

  getInMemory(address: string): PortfolioEntry[] | null {
    const entry = this.inMemoryCache.get(address);
    if (!entry) return null;
    if (this.timer.now() - entry.timestamp > this.maxCacheAge) {
      this.inMemoryCache.delete(address);
      return null;
    }
    return entry.entries;
  }
}
