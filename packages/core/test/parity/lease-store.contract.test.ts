/**
 * LeaseStore Contract Tests
 * Tests SDK LeaseStore against documented legacy behavior fixtures
 * 
 * These tests verify SDK behavior matches the expected outputs defined in fixtures,
 * which capture the behavior of the legacy Totem Wallet implementation.
 */

import { LeaseStore, type StoredLease, type LeaseStatus } from '../../src/lease';
import { MockStorageAdapter, MockLogger, createParityTest, runParityTests, type ParityTestResult } from './test-utils';

interface LeaseFixtureScenario {
  name: string;
  input: {
    operation: string;
    lease?: StoredLease;
    leaseId?: string;
    newStatus?: string;
    leases?: Array<{ leaseId: string; status: string; expiresAt: number }>;
  };
  expectedOutput: {
    stored?: boolean;
    retrievable?: boolean;
    matchesInput?: boolean;
    updated?: boolean;
    finalStatus?: string;
    expiredCount?: number;
    expiredIds?: string[];
    validIds?: string[];
  };
}

interface LeaseFixtures {
  description: string;
  version: string;
  scenarios: LeaseFixtureScenario[];
}

const fixtures: LeaseFixtures = require('./fixtures/lease-store.fixtures.json');

describe('LeaseStore Contract Tests (SDK vs Legacy Behavior)', () => {
  let storage: MockStorageAdapter;
  let logger: MockLogger;
  let leaseStore: LeaseStore;

  beforeEach(async () => {
    storage = new MockStorageAdapter();
    logger = new MockLogger();
    leaseStore = new LeaseStore(storage, logger, { storageKey: 'contract_test_leases' });
    await leaseStore.initialize();
  });

  afterEach(() => {
    storage.reset();
    logger.reset();
  });

  describe('Programmatic Fixture Validation', () => {
    test('all fixture scenarios produce matching outputs via parity runner', async () => {
      const tests = fixtures.scenarios.map(scenario => {
        return createParityTest(
          `[${scenario.name}] ${scenario.input.operation}`,
          async () => scenario.expectedOutput,
          async () => {
            const freshStorage = new MockStorageAdapter();
            const freshLogger = new MockLogger();
            const store = new LeaseStore(freshStorage, freshLogger, { storageKey: 'fixture_test' });
            await store.initialize();

            switch (scenario.input.operation) {
              case 'save': {
                const lease = scenario.input.lease as StoredLease;
                await store.save(lease);
                const retrieved = store.get(lease.leaseId);
                const stored = retrieved !== undefined;
                const retrievable = stored;
                const matchesInput = stored && 
                  retrieved.leaseId === lease.leaseId &&
                  retrieved.leaseToken === lease.leaseToken &&
                  retrieved.status === lease.status &&
                  retrieved.indices.addressIndex === lease.indices.addressIndex &&
                  retrieved.indices.l1 === lease.indices.l1 &&
                  retrieved.indices.l2 === lease.indices.l2 &&
                  retrieved.createdAt === lease.createdAt &&
                  retrieved.expiresAt === lease.expiresAt &&
                  retrieved.leaseTTL === lease.leaseTTL;
                return {
                  stored,
                  retrievable,
                  matchesInput,
                };
              }
              case 'updateStatus': {
                const leaseId = scenario.input.leaseId!;
                const newStatus = scenario.input.newStatus as LeaseStatus;
                const setupLease: StoredLease = {
                  leaseId,
                  leaseToken: 'token-update',
                  indices: { addressIndex: 0, l1: 0, l2: 0 },
                  status: 'active',
                  createdAt: Date.now(),
                  expiresAt: Date.now() + 60000,
                  leaseTTL: 60000,
                };
                await store.save(setupLease);
                await store.updateStatus(leaseId, newStatus);
                return {
                  updated: true,
                  finalStatus: store.get(leaseId)?.status,
                };
              }
              case 'cleanupExpired': {
                const leases = scenario.input.leases!;
                const now = Date.now();

                for (const leaseData of leases) {
                  const lease: StoredLease = {
                    leaseId: leaseData.leaseId,
                    leaseToken: `token-${leaseData.leaseId}`,
                    indices: { addressIndex: 0, l1: 0, l2: 0 },
                    status: leaseData.status as LeaseStatus,
                    createdAt: now - 10000,
                    expiresAt: leaseData.expiresAt === -1 ? now - 1000 : leaseData.expiresAt,
                    leaseTTL: 60000,
                  };
                  await store.save(lease);
                }

                const expiredCount = await store.cleanupExpired();
                
                const allLeases = store.getAll();
                const expiredIds = allLeases.filter(l => l.status === 'expired').map(l => l.leaseId).sort();
                const validIds = allLeases.filter(l => l.status === 'active').map(l => l.leaseId).sort();
                
                return {
                  expiredCount,
                  expiredIds,
                  validIds,
                };
              }
              default:
                throw new Error(`Unknown operation: ${scenario.input.operation}`);
            }
          }
        );
      });

      const { passed, failed, results } = await runParityTests(tests);

      console.log('='.repeat(60));
      console.log('LEASE STORE PARITY REPORT');
      console.log('='.repeat(60));
      console.log(`Fixtures tested: ${fixtures.scenarios.length}`);
      console.log(`Passed: ${passed}`);
      console.log(`Failed: ${failed}`);
      console.log('');

      results.forEach(r => {
        const status = r.passed ? '✓' : '✗';
        console.log(`${status} ${r.description}`);
        if (!r.passed && r.error) {
          console.log(`    Error: ${r.error}`);
        }
        if (!r.passed) {
          console.log(`    Expected: ${JSON.stringify(r.legacyOutput)}`);
          console.log(`    Actual:   ${JSON.stringify(r.sdkOutput)}`);
        }
      });
      console.log('='.repeat(60));

      expect(failed).toBe(0);
    });
  });

  describe('Individual Fixture Validation', () => {
    fixtures.scenarios.forEach(scenario => {
      test(`${scenario.name}: ${scenario.input.operation}`, async () => {
        switch (scenario.input.operation) {
          case 'save': {
            const lease = scenario.input.lease as StoredLease;
            await leaseStore.save(lease);
            const retrieved = leaseStore.get(lease.leaseId);
            
            expect(retrieved).not.toBeUndefined();
            expect(retrieved?.leaseId).toBe(lease.leaseId);
            break;
          }
          case 'updateStatus': {
            const leaseId = scenario.input.leaseId!;
            const newStatus = scenario.input.newStatus as LeaseStatus;
            const setupLease: StoredLease = {
              leaseId,
              leaseToken: 'token-update',
              indices: { addressIndex: 0, l1: 0, l2: 0 },
              status: 'active',
              createdAt: Date.now(),
              expiresAt: Date.now() + 60000,
              leaseTTL: 60000,
            };
            await leaseStore.save(setupLease);
            await leaseStore.updateStatus(leaseId, newStatus);
            
            const updated = leaseStore.get(leaseId);
            expect(updated?.status).toBe(scenario.expectedOutput.finalStatus);
            break;
          }
          case 'cleanupExpired': {
            const leases = scenario.input.leases!;
            const now = Date.now();

            for (const leaseData of leases) {
              const lease: StoredLease = {
                leaseId: leaseData.leaseId,
                leaseToken: `token-${leaseData.leaseId}`,
                indices: { addressIndex: 0, l1: 0, l2: 0 },
                status: leaseData.status as LeaseStatus,
                createdAt: now - 10000,
                expiresAt: leaseData.expiresAt === -1 ? now - 1000 : leaseData.expiresAt,
                leaseTTL: 60000,
              };
              await leaseStore.save(lease);
            }

            const expiredCount = await leaseStore.cleanupExpired();
            expect(expiredCount).toBe(scenario.expectedOutput.expiredCount);
            break;
          }
        }
      });
    });
  });
});
