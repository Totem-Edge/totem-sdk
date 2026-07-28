import { describe, it, expect, vi } from 'vitest';
import { PortfolioCache } from '../PortfolioCache.js';
import type { StorageAdapter, LoggerAdapter } from '@totemsdk/core';
import type { PortfolioEntry } from '../types.js';

function makeMemStorage(): StorageAdapter {
  const store = new Map<string, unknown>();
  return {
    get:    async <T>(key: string) => (store.get(key) as T) ?? null,
    set:    async (key: string, value: unknown) => { store.set(key, value); },
    remove: async (key: string) => { store.delete(key); return true; },
    clear:  async () => { store.clear(); },
    keys:   async () => [...store.keys()],
    has:    async (key: string) => store.has(key),
  };
}

const silentLogger: LoggerAdapter = {
  info:  () => {},
  warn:  () => {},
  error: () => {},
  debug: () => {},
};

function makeEntry(tokenid: string, total: string): PortfolioEntry {
  return {
    kind: tokenid === '0x00' ? 'native' : 'token',
    tokenid,
    confirmed: total,
    unconfirmed: '0',
    sendable: total,
    total,
    decimals: 18,
    name: 'Test Token',
    ticker: 'TT',
    address: 'MxABC',
  };
}

function makeTimer(initial = 0) {
  let current = initial;
  return {
    now: () => current,
    advance: (ms: number) => { current += ms; },
    setTimeout: (_cb: () => void, _ms: number) => 0 as any,
    setInterval: (_cb: () => void, _ms: number) => 0 as any,
    clearTimeout: (_h: any) => {},
    clearInterval: (_h: any) => {},
  };
}

describe('PortfolioCache — set and get', () => {
  it('returns null for a key that was never set', async () => {
    const timer = makeTimer();
    const cache = new PortfolioCache(
      { storage: makeMemStorage(), logger: silentLogger, timer },
      { maxCacheAge: 60_000 }
    );
    expect(await cache.get('MxABC')).toBeNull();
  });

  it('returns the stored entries immediately after set', async () => {
    const timer = makeTimer();
    const cache = new PortfolioCache(
      { storage: makeMemStorage(), logger: silentLogger, timer },
      { maxCacheAge: 60_000 }
    );
    const entries = [makeEntry('0x00', '100')];
    await cache.set('MxABC', entries);
    expect(await cache.get('MxABC')).toEqual(entries);
  });

  it('serves the in-memory cache without hitting storage on the second get', async () => {
    const storage = makeMemStorage();
    const getSpy = vi.spyOn(storage, 'get');
    const timer = makeTimer();
    const cache = new PortfolioCache(
      { storage, logger: silentLogger, timer },
      { maxCacheAge: 60_000 }
    );
    await cache.set('MxABC', [makeEntry('0x00', '50')]);
    getSpy.mockClear();
    await cache.get('MxABC');
    expect(getSpy).not.toHaveBeenCalled();
  });
});

describe('PortfolioCache — expiry', () => {
  it('returns null when the entry has expired', async () => {
    const timer = makeTimer(0);
    const cache = new PortfolioCache(
      { storage: makeMemStorage(), logger: silentLogger, timer },
      { maxCacheAge: 1_000 }
    );
    await cache.set('MxABC', [makeEntry('0x00', '10')]);
    timer.advance(2_000);
    expect(await cache.get('MxABC')).toBeNull();
  });

  it('returns entries when they are exactly at the maxCacheAge boundary', async () => {
    const timer = makeTimer(0);
    const cache = new PortfolioCache(
      { storage: makeMemStorage(), logger: silentLogger, timer },
      { maxCacheAge: 1_000 }
    );
    await cache.set('MxABC', [makeEntry('0x00', '10')]);
    timer.advance(1_000); // exactly at boundary — valid (now - ts === maxCacheAge, check is <=)
    expect(await cache.get('MxABC')).not.toBeNull();
  });
});

describe('PortfolioCache — remove', () => {
  it('returns null after remove', async () => {
    const timer = makeTimer();
    const cache = new PortfolioCache(
      { storage: makeMemStorage(), logger: silentLogger, timer },
      { maxCacheAge: 60_000 }
    );
    await cache.set('MxABC', [makeEntry('0x00', '10')]);
    await cache.remove('MxABC');
    expect(await cache.get('MxABC')).toBeNull();
  });
});

describe('PortfolioCache — multiple addresses', () => {
  it('stores and retrieves independently for different addresses', async () => {
    const timer = makeTimer();
    const cache = new PortfolioCache(
      { storage: makeMemStorage(), logger: silentLogger, timer },
      { maxCacheAge: 60_000 }
    );
    const a = [makeEntry('0x00', '100')];
    const b = [makeEntry('0x00', '200')];
    await cache.set('MxABC', a);
    await cache.set('MxDEF', b);
    expect(await cache.get('MxABC')).toEqual(a);
    expect(await cache.get('MxDEF')).toEqual(b);
  });

  it('getAll returns all non-expired entries', async () => {
    const timer = makeTimer(0);
    const cache = new PortfolioCache(
      { storage: makeMemStorage(), logger: silentLogger, timer },
      { maxCacheAge: 60_000 }
    );
    await cache.set('MxABC', [makeEntry('0x00', '10')]);
    await cache.set('MxDEF', [makeEntry('0x00', '20')]);
    const all = await cache.getAll();
    expect(Object.keys(all)).toHaveLength(2);
    expect(all['MxABC']).toBeDefined();
    expect(all['MxDEF']).toBeDefined();
  });

  it('getAll excludes expired entries', async () => {
    const timer = makeTimer(0);
    const cache = new PortfolioCache(
      { storage: makeMemStorage(), logger: silentLogger, timer },
      { maxCacheAge: 1_000 }
    );
    await cache.set('MxABC', [makeEntry('0x00', '10')]);
    timer.advance(2_000);
    await cache.set('MxDEF', [makeEntry('0x00', '20')]); // still fresh
    const all = await cache.getAll();
    expect(all['MxABC']).toBeUndefined();
    expect(all['MxDEF']).toBeDefined();
  });
});

describe('PortfolioCache — clear', () => {
  it('empties all entries', async () => {
    const timer = makeTimer();
    const cache = new PortfolioCache(
      { storage: makeMemStorage(), logger: silentLogger, timer },
      { maxCacheAge: 60_000 }
    );
    await cache.set('MxABC', [makeEntry('0x00', '10')]);
    await cache.set('MxDEF', [makeEntry('0x00', '20')]);
    await cache.clear();
    expect(await cache.get('MxABC')).toBeNull();
    expect(await cache.get('MxDEF')).toBeNull();
  });
});

describe('PortfolioCache — cleanup', () => {
  it('removes expired entries and returns count removed', async () => {
    const timer = makeTimer(0);
    const cache = new PortfolioCache(
      { storage: makeMemStorage(), logger: silentLogger, timer },
      { maxCacheAge: 1_000 }
    );
    await cache.set('MxABC', [makeEntry('0x00', '10')]);
    await cache.set('MxDEF', [makeEntry('0x00', '20')]);
    timer.advance(2_000);
    const removed = await cache.cleanup();
    expect(removed).toBe(2);
    expect(await cache.get('MxABC')).toBeNull();
    expect(await cache.get('MxDEF')).toBeNull();
  });
});

describe('PortfolioCache — storage persistence across instances', () => {
  it('reads from storage after a new instance is created with the same store', async () => {
    const storage = makeMemStorage();
    const timer = makeTimer(0);
    const cache1 = new PortfolioCache(
      { storage, logger: silentLogger, timer },
      { maxCacheAge: 60_000 }
    );
    const entries = [makeEntry('0x00', '77')];
    await cache1.set('MxABC', entries);

    const cache2 = new PortfolioCache(
      { storage, logger: silentLogger, timer },
      { maxCacheAge: 60_000 }
    );
    expect(await cache2.get('MxABC')).toEqual(entries);
  });
});
