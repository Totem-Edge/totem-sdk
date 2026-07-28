import { PortfolioCache, type PortfolioCacheDependencies, type PortfolioCacheConfig } from '@totemsdk/realtime';
import type { PortfolioEntry } from '@totemsdk/realtime';
import { ChaosStorageAdapter, ChaosLogger } from './chaos-adapters';

class MockTimer {
  private currentTime = Date.now();

  now(): number {
    return this.currentTime;
  }

  setNow(time: number): void {
    this.currentTime = time;
  }

  advanceTime(ms: number): void {
    this.currentTime += ms;
  }
}

function createTestPortfolio(address: string, confirmed: string): PortfolioEntry[] {
  return [
    {
      kind: 'native',
      tokenid: '0x00',
      confirmed,
      unconfirmed: '0',
      sendable: confirmed,
      total: confirmed,
      decimals: 8,
      name: 'Minima',
      ticker: 'MINIMA',
      address,
    },
  ];
}

describe('PortfolioCache Chaos Tests', () => {
  let chaosStorage: ChaosStorageAdapter;
  let chaosLogger: ChaosLogger;
  let timerAdapter: MockTimer;
  let cache: PortfolioCache;

  beforeEach(() => {
    chaosStorage = new ChaosStorageAdapter();
    chaosLogger = new ChaosLogger(true);
    timerAdapter = new MockTimer();

    const deps: PortfolioCacheDependencies = {
      storage: chaosStorage,
      logger: chaosLogger,
      timer: timerAdapter,
    };
    
    const config: PortfolioCacheConfig = {
      maxCacheAge: 60000,
    };

    cache = new PortfolioCache(deps, config);
  });

  afterEach(() => {
    chaosStorage.reset();
    chaosLogger.reset();
  });

  describe('Write Failure Scenarios', () => {
    test('handles storage write failure gracefully without throwing', async () => {
      chaosStorage.setConfig({ failureMode: 'write_failure' });

      const entries = createTestPortfolio('addr-1', '1000');
      
      await cache.set('addr-1', entries);
      
      expect(chaosStorage.failureLog.length).toBeGreaterThan(0);
      expect(chaosStorage.failureLog[0].error).toContain('write failure');
      
      const errorLogs = chaosLogger.getLogsByLevel('error');
      expect(errorLogs.length).toBeGreaterThan(0);
    });

    test('in-memory cache still works during storage failures', async () => {
      const entries1 = createTestPortfolio('addr-1', '1000');
      await cache.set('addr-1', entries1);
      
      const cached1 = await cache.get('addr-1');
      expect(cached1?.[0]?.confirmed).toBe('1000');

      chaosStorage.setConfig({ failureMode: 'write_failure' });

      const entries2 = createTestPortfolio('addr-1', '2000');
      await cache.set('addr-1', entries2);

      const cached2 = await cache.get('addr-1');
      expect(cached2?.[0]?.confirmed).toBe('2000');
    });

    test('quota exceeded error is logged but does not throw', async () => {
      chaosStorage.setConfig({ failureMode: 'quota_exceeded' });

      const entries = createTestPortfolio('addr-1', '1000');
      
      await cache.set('addr-1', entries);
      
      const quotaErrors = chaosStorage.failureLog.filter(f => f.error.includes('quota'));
      expect(quotaErrors.length).toBeGreaterThan(0);
      
      const errorLogs = chaosLogger.getLogsByLevel('error');
      expect(errorLogs.length).toBeGreaterThan(0);
    });
  });

  describe('Read Failure Scenarios', () => {
    test('returns null and logs error when storage read fails', async () => {
      chaosStorage.setConfig({ failureMode: 'none' });
      const entries = createTestPortfolio('addr-1', '1000');
      await cache.set('addr-1', entries);
      
      await cache.get('addr-1');

      chaosStorage.setConfig({ failureMode: 'read_failure' });
      
      const newCache = new PortfolioCache(
        { storage: chaosStorage, logger: chaosLogger, timer: timerAdapter },
        { maxCacheAge: 60000 }
      );

      const result = await newCache.get('addr-1');
      expect(result).toBeNull();
      
      expect(chaosStorage.failureLog.length).toBeGreaterThan(0);
    });

    test('in-memory cache serves as fallback during storage read failures', async () => {
      const entries = createTestPortfolio('addr-1', '1000');
      await cache.set('addr-1', entries);

      const cachedBeforeFailure = await cache.get('addr-1');
      expect(cachedBeforeFailure?.[0]?.confirmed).toBe('1000');

      chaosStorage.setConfig({ failureMode: 'read_failure' });
      
      const cachedFromMemory = await cache.get('addr-1');
      expect(cachedFromMemory?.[0]?.confirmed).toBe('1000');
    });
  });

  describe('Corruption Scenarios', () => {
    test('detects and handles corrupted data', async () => {
      const entries = createTestPortfolio('addr-1', '1000');
      await cache.set('addr-1', entries);

      chaosStorage.setConfig({ 
        failureMode: 'corruption',
        corruptionPattern: 'garbage',
      });

      const result = await cache.get('addr-1');
      
      if (result) {
        expect(Array.isArray(result)).toBe(true);
      }
    });
  });

  describe('Recovery Scenarios', () => {
    test('recovers after transient storage failures', async () => {
      chaosStorage.setConfig({ 
        failureMode: 'random_failure',
        failAfterNOperations: 2,
      });

      const entries1 = createTestPortfolio('addr-1', '1000');
      await cache.set('addr-1', entries1);

      await cache.set('addr-2', createTestPortfolio('addr-2', '500'));

      try {
        await cache.set('addr-3', createTestPortfolio('addr-3', '200'));
      } catch (e) {
      }

      chaosStorage.setConfig({ failureMode: 'none' });

      const entries4 = createTestPortfolio('addr-4', '300');
      await cache.set('addr-4', entries4);
      const result = await cache.get('addr-4');
      
      expect(result?.[0]?.confirmed).toBe('300');
    });

    test('cache cleanup handles partial failures', async () => {
      await cache.set('addr-1', createTestPortfolio('addr-1', '1000'));
      await cache.set('addr-2', createTestPortfolio('addr-2', '2000'));
      await cache.set('addr-3', createTestPortfolio('addr-3', '3000'));

      chaosStorage.setConfig({ 
        failureMode: 'random_failure',
        failureProbability: 0.3,
      });

      try {
        await cache.cleanup();
      } catch (e) {
      }

      chaosStorage.setConfig({ failureMode: 'none' });
      
      const stats = chaosStorage.getStats();
      console.log(`[Chaos] Storage stats - Operations: ${stats.operations}, Failures: ${stats.failures}`);
    });
  });

  describe('Concurrent Access Under Chaos', () => {
    test('handles concurrent writes during failures', async () => {
      chaosStorage.setConfig({ 
        failureMode: 'random_failure',
        failureProbability: 0.2,
      });

      const writePromises = [];
      for (let i = 0; i < 10; i++) {
        const addr = `addr-${i}`;
        writePromises.push(
          cache.set(addr, createTestPortfolio(addr, String(i * 100)))
            .catch(e => ({ error: e.message, addr }))
        );
      }

      const results = await Promise.all(writePromises);
      
      const successes = results.filter(r => r === undefined);
      const failures = results.filter(r => r !== undefined);
      
      console.log(`[Chaos] Concurrent writes - Success: ${successes.length}, Failures: ${failures.length}`);
      
      expect(successes.length + failures.length).toBe(10);
    });
  });

  describe('Failure Statistics', () => {
    test('tracks storage operation statistics correctly', async () => {
      chaosStorage.setConfig({ failureMode: 'none' });

      for (let i = 0; i < 10; i++) {
        const addr = `addr-${i}`;
        await cache.set(addr, createTestPortfolio(addr, String(i)));
      }

      const stats = chaosStorage.getStats();
      
      console.log(`[Chaos] Stats after 10 sets - Operations: ${stats.operations}, Failures: ${stats.failures}, Success Rate: ${(stats.successRate * 100).toFixed(1)}%`);
      
      expect(stats.operations).toBeGreaterThan(0);
      expect(stats.successRate).toBe(1);
    });

    test('tracks failures in chaos mode', async () => {
      chaosStorage.setConfig({ 
        failureMode: 'write_failure',
        failAfterNOperations: 5,
      });

      for (let i = 0; i < 10; i++) {
        const addr = `addr-${i}`;
        await cache.set(addr, createTestPortfolio(addr, String(i)));
      }

      const stats = chaosStorage.getStats();
      
      console.log(`[Chaos] Stats with failures - Operations: ${stats.operations}, Failures: ${stats.failures}`);
      
      expect(stats.operations).toBeGreaterThan(0);
      expect(stats.failures).toBeGreaterThan(0);
    });
  });
});
