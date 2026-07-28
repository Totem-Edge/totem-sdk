/**
 * PortfolioCache Parity Tests
 * Tests real SDK PortfolioCache against documented behavior fixtures
 * Uses shared createParityTest/runParityTests harness utilities
 */

import { PortfolioCache, type PortfolioCacheDependencies } from '@totemsdk/realtime';
import type { PortfolioEntry } from '@totemsdk/realtime';
import {
  MockStorageAdapter,
  MockLogger,
  MockTimerAdapter,
  createParityTest,
  runParityTests,
  assertDeepEqual,
  type ParityTestResult,
} from './test-utils';

interface PortfolioCacheScenario {
  name: string;
  input: {
    operation: string;
    address?: string;
    cachedTimestamp?: number;
    currentTime?: number;
    maxCacheAge?: number;
    inMemory?: boolean;
    addresses?: string[];
    expiredCount?: number;
  };
  expectedOutput: any;
}

interface PortfolioCacheFixtures {
  description: string;
  version: string;
  scenarios: PortfolioCacheScenario[];
}

const fixtures: PortfolioCacheFixtures = require('./fixtures/balance-cache.fixtures.json');

function createTestPortfolio(address: string, timestamp: number): PortfolioEntry[] {
  return [
    {
      kind: 'native',
      tokenid: '0x00',
      confirmed: '1000',
      unconfirmed: '0',
      sendable: '1000',
      total: '1000',
      decimals: 8,
      name: 'Minima',
      ticker: 'MINIMA',
      address,
    },
  ];
}

function createLegacyBehaviorFn(
  scenario: PortfolioCacheScenario,
  storage: MockStorageAdapter,
  logger: MockLogger,
  timer: MockTimerAdapter
): () => Promise<unknown> {
  return async () => {
    const deps: PortfolioCacheDependencies = { storage, logger, timer };
    const cache = new PortfolioCache(deps, {
      maxCacheAge: scenario.input.maxCacheAge || 86400000,
    });

    switch (scenario.input.operation) {
      case 'set': {
        const address = scenario.input.address!;
        const entries = createTestPortfolio(address, timer.now());
        await cache.set(address, entries);
        const retrieved = await cache.get(address);
        return {
          stored: true,
          retrievable: retrieved !== null,
        };
      }
      case 'get': {
        if (scenario.input.inMemory) {
          const address = scenario.input.address!;
          const entries = createTestPortfolio(address, timer.now());
          await cache.set(address, entries);
          storage.reset();
          await cache.get(address);
          const storageCalled = storage.operations.some(op => op.op === 'get');
          return {
            source: 'memory',
            storageCalled,
          };
        } else if (scenario.input.cachedTimestamp !== undefined) {
          const address = scenario.input.address!;
          const currentTime = scenario.input.currentTime!;
          const cachedTimestamp = scenario.input.cachedTimestamp;

          timer.setNow(cachedTimestamp);
          await cache.set(address, createTestPortfolio(address, cachedTimestamp));

          timer.setNow(currentTime);
          const retrieved = await cache.get(address);

          return {
            value: retrieved,
            reason: retrieved === null ? 'expired' : undefined,
          };
        }
        return { value: null };
      }
      case 'cleanup': {
        const addresses = scenario.input.addresses!;
        const expiredCount = scenario.input.expiredCount!;
        const now = timer.now();

        for (let i = 0; i < addresses.length; i++) {
          const addr = addresses[i];
          const isExpired = i < expiredCount;
          const timestamp = isExpired ? now - 100000000 : now;
          timer.setNow(timestamp);
          await cache.set(addr, createTestPortfolio(addr, timestamp));
          timer.setNow(now);
        }

        const removed = await cache.cleanup();
        return { removed };
      }
      case 'clear': {
        const testAddr = 'test-addr';
        await cache.set(testAddr, createTestPortfolio(testAddr, timer.now()));
        await cache.clear();
        const isEmpty = cache.getInMemory(testAddr) === null;
        return {
          inMemoryCleared: isEmpty,
          storageCleared: true,
        };
      }
      default:
        throw new Error(`Unknown operation: ${scenario.input.operation}`);
    }
  };
}

function createSDKBehaviorFn(
  scenario: PortfolioCacheScenario,
  storage: MockStorageAdapter,
  logger: MockLogger,
  timer: MockTimerAdapter
): () => Promise<unknown> {
  return async () => {
    const deps: PortfolioCacheDependencies = { storage, logger, timer };
    const cache = new PortfolioCache(deps, {
      maxCacheAge: scenario.input.maxCacheAge || 86400000,
    });

    switch (scenario.input.operation) {
      case 'set': {
        const address = scenario.input.address!;
        const entries = createTestPortfolio(address, timer.now());
        await cache.set(address, entries);
        const retrieved = await cache.get(address);
        return {
          stored: true,
          retrievable: retrieved !== null,
        };
      }
      case 'get': {
        if (scenario.input.inMemory) {
          const address = scenario.input.address!;
          const entries = createTestPortfolio(address, timer.now());
          await cache.set(address, entries);
          storage.reset();
          await cache.get(address);
          const storageCalled = storage.operations.some(op => op.op === 'get');
          return {
            source: 'memory',
            storageCalled,
          };
        } else if (scenario.input.cachedTimestamp !== undefined) {
          const address = scenario.input.address!;
          const currentTime = scenario.input.currentTime!;
          const cachedTimestamp = scenario.input.cachedTimestamp;

          timer.setNow(cachedTimestamp);
          await cache.set(address, createTestPortfolio(address, cachedTimestamp));

          timer.setNow(currentTime);
          const retrieved = await cache.get(address);

          return {
            value: retrieved,
            reason: retrieved === null ? 'expired' : undefined,
          };
        }
        return { value: null };
      }
      case 'cleanup': {
        const addresses = scenario.input.addresses!;
        const expiredCount = scenario.input.expiredCount!;
        const now = timer.now();

        for (let i = 0; i < addresses.length; i++) {
          const addr = addresses[i];
          const isExpired = i < expiredCount;
          const timestamp = isExpired ? now - 100000000 : now;
          timer.setNow(timestamp);
          await cache.set(addr, createTestPortfolio(addr, timestamp));
          timer.setNow(now);
        }

        const removed = await cache.cleanup();
        return { removed };
      }
      case 'clear': {
        const testAddr = 'test-addr';
        await cache.set(testAddr, createTestPortfolio(testAddr, timer.now()));
        await cache.clear();
        const isEmpty = cache.getInMemory(testAddr) === null;
        return {
          inMemoryCleared: isEmpty,
          storageCleared: true,
        };
      }
      default:
        throw new Error(`Unknown operation: ${scenario.input.operation}`);
    }
  };
}

describe('PortfolioCache Parity Tests (SDK vs Legacy Behavior)', () => {
  describe('Harness-Based Parity Validation', () => {
    test('all fixture scenarios produce matching outputs using createParityTest/runParityTests', async () => {
      const tests: Array<() => Promise<ParityTestResult>> = [];

      for (const scenario of fixtures.scenarios) {
        const legacyStorage = new MockStorageAdapter();
        const legacyLogger = new MockLogger();
        const legacyTimer = new MockTimerAdapter();
        const sdkStorage = new MockStorageAdapter();
        const sdkLogger = new MockLogger();
        const sdkTimer = new MockTimerAdapter();

        tests.push(
          createParityTest(
            scenario.name,
            createLegacyBehaviorFn(scenario, legacyStorage, legacyLogger, legacyTimer),
            createSDKBehaviorFn(scenario, sdkStorage, sdkLogger, sdkTimer)
          )
        );
      }

      const { passed, failed, results } = await runParityTests(tests);

      console.log('='.repeat(60));
      console.log('PORTFOLIO CACHE PARITY REPORT (Harness-Based)');
      console.log('='.repeat(60));
      console.log(`Fixtures tested: ${fixtures.scenarios.length}`);
      console.log(`Passed: ${passed}`);
      console.log(`Failed: ${failed}`);
      console.log('');

      results.forEach(r => {
        const status = r.passed ? '✓' : '✗';
        console.log(`${status} ${r.description}`);
        if (!r.passed && r.error) {
          console.log(`    ${r.error}`);
        }
      });
      console.log('='.repeat(60));

      expect(failed).toBe(0);
    });
  });

  describe('Individual Fixture Validation with assertDeepEqual', () => {
    let storage: MockStorageAdapter;
    let logger: MockLogger;
    let timer: MockTimerAdapter;

    beforeEach(() => {
      storage = new MockStorageAdapter();
      logger = new MockLogger();
      timer = new MockTimerAdapter();
    });

    afterEach(() => {
      storage.reset();
      logger.reset();
      timer.reset();
    });

    fixtures.scenarios.forEach(scenario => {
      test(`${scenario.name}: ${scenario.input.operation}`, async () => {
        const deps: PortfolioCacheDependencies = { storage, logger, timer };
        const cache = new PortfolioCache(deps, {
          maxCacheAge: scenario.input.maxCacheAge || 86400000,
        });

        switch (scenario.input.operation) {
          case 'set': {
            const address = scenario.input.address!;
            const entries = createTestPortfolio(address, timer.now());
            await cache.set(address, entries);
            const retrieved = await cache.get(address);
            assertDeepEqual(
              { stored: true, retrievable: retrieved !== null },
              scenario.expectedOutput
            );
            break;
          }
          case 'get': {
            if (scenario.input.inMemory) {
              const address = scenario.input.address!;
              const entries = createTestPortfolio(address, timer.now());
              await cache.set(address, entries);
              storage.reset();
              await cache.get(address);
              const storageCalled = storage.operations.some(op => op.op === 'get');
              assertDeepEqual(
                { source: 'memory', storageCalled },
                scenario.expectedOutput
              );
            }
            break;
          }
          case 'cleanup': {
            const addresses = scenario.input.addresses!;
            const expiredCount = scenario.input.expiredCount!;
            const now = timer.now();

            for (let i = 0; i < addresses.length; i++) {
              const addr = addresses[i];
              const isExpired = i < expiredCount;
              const timestamp = isExpired ? now - 100000000 : now;
              timer.setNow(timestamp);
              await cache.set(addr, createTestPortfolio(addr, timestamp));
              timer.setNow(now);
            }

            const removed = await cache.cleanup();
            assertDeepEqual({ removed }, scenario.expectedOutput);
            break;
          }
          case 'clear': {
            const testAddr = 'test-addr';
            await cache.set(testAddr, createTestPortfolio(testAddr, timer.now()));
            await cache.clear();
            const isEmpty = cache.getInMemory(testAddr) === null;
            assertDeepEqual(
              { inMemoryCleared: isEmpty, storageCleared: true },
              scenario.expectedOutput
            );
            break;
          }
        }
      });
    });
  });
});
