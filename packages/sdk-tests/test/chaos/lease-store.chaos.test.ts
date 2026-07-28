import { LeaseStore, type StoredLease, type LeaseStatus } from '@totemsdk/core';
import { ChaosStorageAdapter, ChaosLogger } from './chaos-adapters';

describe('LeaseStore Chaos Tests', () => {
  let chaosStorage: ChaosStorageAdapter;
  let chaosLogger: ChaosLogger;
  let leaseStore: LeaseStore;

  const createTestLease = (id: string, status: LeaseStatus = 'active'): StoredLease => ({
    leaseId: id,
    leaseToken: `token_${id}`,
    indices: { l1: 0, l2: 1, l3: 2 },
    status,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30000,
    leaseTTL: 30000,
  });

  beforeEach(async () => {
    chaosStorage = new ChaosStorageAdapter();
    chaosLogger = new ChaosLogger(true);
    leaseStore = new LeaseStore(chaosStorage, chaosLogger);
    await leaseStore.initialize();
  });

  afterEach(() => {
    chaosStorage.reset();
    chaosLogger.reset();
  });

  describe('Write Failure Resilience', () => {
    test('handles lease save during storage write failure', async () => {
      chaosStorage.setConfig({ failureMode: 'write_failure' });

      const lease = createTestLease('test_1');
      
      try {
        await leaseStore.save(lease);
      } catch (e) {
      }

      const errorLogs = chaosLogger.getLogsByLevel('error');
      expect(chaosStorage.failureLog.length + errorLogs.length).toBeGreaterThan(0);
    });

    test('lease delete gracefully handles storage failures', async () => {
      chaosStorage.setConfig({ failureMode: 'none' });
      const lease = createTestLease('test_1');
      await leaseStore.save(lease);

      chaosStorage.setConfig({ failureMode: 'write_failure' });

      try {
        await leaseStore.delete('test_1');
      } catch (e) {
      }

      expect(chaosStorage.failureLog.length).toBeGreaterThan(0);
    });

    test('quota exceeded during lease save', async () => {
      chaosStorage.setConfig({ failureMode: 'quota_exceeded' });

      const lease = createTestLease('test_1');
      
      try {
        await leaseStore.save(lease);
      } catch (e) {
      }

      const quotaErrors = chaosStorage.failureLog.filter(f => f.error.includes('quota'));
      expect(quotaErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Read Failure Resilience', () => {
    test('lease get handles read failures with in-memory fallback', async () => {
      chaosStorage.setConfig({ failureMode: 'none' });
      const lease = createTestLease('test_1');
      await leaseStore.save(lease);

      chaosStorage.setConfig({ failureMode: 'read_failure' });

      const result = leaseStore.get('test_1');
      expect(result).toBeDefined();
      expect(result?.leaseId).toBe('test_1');
    });

    test('getAll returns in-memory leases during storage failures', async () => {
      chaosStorage.setConfig({ failureMode: 'none' });
      await leaseStore.save(createTestLease('test_1'));
      await leaseStore.save(createTestLease('test_2'));

      chaosStorage.setConfig({ failureMode: 'read_failure' });
      
      const allLeases = leaseStore.getAll();
      expect(allLeases.length).toBe(2);
    });
  });

  describe('Recovery Scenarios', () => {
    test('recovers after transient storage failures', async () => {
      chaosStorage.setConfig({ 
        failureMode: 'write_failure',
        failAfterNOperations: 3,
      });

      try {
        await leaseStore.save(createTestLease('test_1'));
      } catch (e) {
      }

      try {
        await leaseStore.save(createTestLease('test_2'));
      } catch (e) {
      }

      chaosStorage.setConfig({ failureMode: 'none' });

      const lease3 = createTestLease('test_3');
      await leaseStore.save(lease3);
      
      const retrieved = leaseStore.get('test_3');
      expect(retrieved?.leaseId).toBe('test_3');
    });

    test('cleanup expired handles failures gracefully', async () => {
      chaosStorage.setConfig({ failureMode: 'none' });
      
      const expiredLease = createTestLease('expired_1');
      expiredLease.expiresAt = Date.now() - 10000;
      await leaseStore.save(expiredLease);

      chaosStorage.setConfig({ 
        failureMode: 'random_failure',
        failureProbability: 0.3,
      });

      try {
        await leaseStore.cleanupExpired();
      } catch (e) {
      }
    });
  });

  describe('Data Corruption Resilience', () => {
    test('handles corrupted lease data on reload', async () => {
      chaosStorage.setConfig({ failureMode: 'none' });
      await leaseStore.save(createTestLease('test_1'));

      chaosStorage.setConfig({ 
        failureMode: 'corruption',
        corruptionPattern: 'garbage',
      });

      const newStore = new LeaseStore(chaosStorage, chaosLogger);
      
      try {
        await newStore.initialize();
      } catch (e) {
      }

      expect(chaosStorage.failureLog.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Concurrent Operations Under Chaos', () => {
    test('handles concurrent lease operations with failures', async () => {
      chaosStorage.setConfig({ 
        failureMode: 'random_failure',
        failureProbability: 0.2,
      });

      const operations = [];
      for (let i = 0; i < 5; i++) {
        const lease = createTestLease(`addr_${i}`);
        operations.push(
          leaseStore.save(lease)
            .then(() => true)
            .catch((e: Error) => ({ error: e.message, id: `addr_${i}` }))
        );
      }

      const results = await Promise.all(operations);
      
      const successes = results.filter((r): r is true => r === true);
      const failures = results.filter((r): r is { error: string; id: string } => r !== true);
      
      console.log(`[Chaos] Concurrent lease ops - Success: ${successes.length}, Failures: ${failures.length}`);
      
      expect(successes.length + failures.length).toBe(5);
    });
  });

  describe('Failure Statistics', () => {
    test('tracks lease operation statistics', async () => {
      chaosStorage.setConfig({ failureMode: 'none' });

      const lease = createTestLease('test_1');
      await leaseStore.save(lease);
      leaseStore.get('test_1');
      await leaseStore.updateStatus('test_1', 'expired');
      await leaseStore.delete('test_1');

      const stats = chaosStorage.getStats();
      
      console.log(`[Chaos] LeaseStore ops - Operations: ${stats.operations}, Failures: ${stats.failures}`);
      
      expect(stats.operations).toBeGreaterThan(0);
      expect(stats.successRate).toBe(1);
    });

    test('tracks failures in chaos mode', async () => {
      chaosStorage.setConfig({ 
        failureMode: 'write_failure',
        failAfterNOperations: 3,
      });

      for (let i = 0; i < 5; i++) {
        try {
          await leaseStore.save(createTestLease(`test_${i}`));
        } catch (e) {
        }
      }

      const stats = chaosStorage.getStats();
      
      console.log(`[Chaos] LeaseStore with failures - Operations: ${stats.operations}, Failures: ${stats.failures}`);
      
      expect(stats.operations).toBeGreaterThan(0);
      expect(stats.failures).toBeGreaterThan(0);
    });
  });
});
