/**
 * LeaseStore Parity Tests
 * Compares SDK LeaseStore with expected behavior for migration safety
 */

import { LeaseStore, type StoredLease, type LeaseStatus, type WotsIndices } from '../../src/lease';
import { MockStorageAdapter, MockLogger } from './test-utils';

describe('LeaseStore Parity Tests', () => {
  let storage: MockStorageAdapter;
  let logger: MockLogger;
  let leaseStore: LeaseStore;

  const testIndices: WotsIndices = { addressIndex: 0, l1: 0, l2: 0 };

  const testLease: StoredLease = {
    leaseId: 'test-lease-1',
    leaseToken: 'token-123',
    indices: testIndices,
    status: 'active' as LeaseStatus,
    createdAt: 1000000,
    expiresAt: Date.now() + 100000,
    leaseTTL: 100000,
    txId: 'tx-123',
  };

  beforeEach(async () => {
    storage = new MockStorageAdapter();
    logger = new MockLogger();
    leaseStore = new LeaseStore(storage, logger, { storageKey: 'parity_test_leases' });
    await leaseStore.initialize();
  });

  afterEach(() => {
    storage.reset();
    logger.reset();
  });

  describe('Basic CRUD Operations', () => {
    test('save and retrieve lease produces expected output', async () => {
      await leaseStore.save(testLease);
      const retrieved = leaseStore.get(testLease.leaseId);
      
      expect(retrieved).toEqual(testLease);
    });

    test('get non-existent lease returns undefined', () => {
      const result = leaseStore.get('non-existent');
      expect(result).toBeUndefined();
    });

    test('update lease status produces expected state', async () => {
      await leaseStore.save(testLease);
      await leaseStore.updateStatus(testLease.leaseId, 'finalized');
      
      const updated = leaseStore.get(testLease.leaseId);
      expect(updated?.status).toBe('finalized');
    });

    test('delete lease removes it from storage', async () => {
      await leaseStore.save(testLease);
      await leaseStore.delete(testLease.leaseId);
      
      const result = leaseStore.get(testLease.leaseId);
      expect(result).toBeUndefined();
    });

    test('getAll returns all stored leases', async () => {
      const lease2: StoredLease = { 
        ...testLease, 
        leaseId: 'test-lease-2', 
        leaseToken: 'token-456',
        indices: { addressIndex: 0, l1: 0, l2: 1 },
      };
      
      await leaseStore.save(testLease);
      await leaseStore.save(lease2);
      
      const all = leaseStore.getAll();
      expect(all).toHaveLength(2);
      expect(all.map(l => l.leaseId).sort()).toEqual(['test-lease-1', 'test-lease-2']);
    });
  });

  describe('Status Filtering', () => {
    test('getActive filters correctly', async () => {
      const now = Date.now();
      const activeLease: StoredLease = {
        ...testLease,
        status: 'active',
        expiresAt: now + 100000,
      };
      const expiredLease: StoredLease = {
        ...testLease,
        leaseId: 'expired-lease',
        leaseToken: 'token-expired',
        status: 'expired',
        expiresAt: now - 1000,
      };
      const finalizedLease: StoredLease = {
        ...testLease,
        leaseId: 'finalized-lease',
        leaseToken: 'token-finalized',
        status: 'finalized',
        expiresAt: now + 100000,
      };

      await leaseStore.save(activeLease);
      await leaseStore.save(expiredLease);
      await leaseStore.save(finalizedLease);

      const active = leaseStore.getActive();
      expect(active.map(l => l.leaseId)).toEqual(['test-lease-1']);
    });
  });

  describe('Token Operations', () => {
    test('getByToken returns correct lease', async () => {
      await leaseStore.save(testLease);
      
      const found = leaseStore.getByToken('token-123');
      expect(found).toEqual(testLease);
    });

    test('getByToken returns undefined for non-existent token', async () => {
      await leaseStore.save(testLease);
      
      const notFound = leaseStore.getByToken('non-existent-token');
      expect(notFound).toBeUndefined();
    });

    test('deleteByToken removes correct lease', async () => {
      await leaseStore.save(testLease);
      await leaseStore.deleteByToken('token-123');
      
      const result = leaseStore.get(testLease.leaseId);
      expect(result).toBeUndefined();
    });
  });

  describe('Expiring Soon Detection', () => {
    test('getExpiringSoon returns leases near expiry', async () => {
      const now = Date.now();
      const expiringSoon: StoredLease = {
        leaseId: 'expiring-soon',
        leaseToken: 'token-expiring',
        indices: { addressIndex: 0, l1: 0, l2: 0 },
        status: 'active' as LeaseStatus,
        createdAt: now,
        expiresAt: now + 3000,
        leaseTTL: 3000,
      };
      const notExpiringSoon: StoredLease = {
        leaseId: 'not-expiring-soon',
        leaseToken: 'token-safe',
        indices: { addressIndex: 0, l1: 0, l2: 1 },
        status: 'active' as LeaseStatus,
        createdAt: now,
        expiresAt: now + 500000,
        leaseTTL: 500000,
      };

      await leaseStore.save(expiringSoon);
      await leaseStore.save(notExpiringSoon);

      const expiring = leaseStore.getExpiringSoon(10000);
      expect(expiring.some(l => l.leaseId === 'expiring-soon')).toBe(true);
      expect(expiring.some(l => l.leaseId === 'not-expiring-soon')).toBe(false);
    });
  });

  describe('Persistence', () => {
    test('state persists across store instances', async () => {
      await leaseStore.save(testLease);
      
      const leaseStore2 = new LeaseStore(storage, logger, { storageKey: 'parity_test_leases' });
      await leaseStore2.initialize();
      
      const retrieved = leaseStore2.get(testLease.leaseId);
      expect(retrieved).toEqual(testLease);
    });

    test('storage operations are tracked', async () => {
      await leaseStore.save(testLease);
      
      const setOps = storage.operations.filter(op => op.op === 'set');
      expect(setOps.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    test('saving same lease twice overwrites', async () => {
      await leaseStore.save(testLease);
      
      const updatedLease: StoredLease = { ...testLease, status: 'finalized' };
      await leaseStore.save(updatedLease);
      
      const retrieved = leaseStore.get(testLease.leaseId);
      expect(retrieved?.status).toBe('finalized');
      
      const all = leaseStore.getAll();
      expect(all).toHaveLength(1);
    });

    test('clear removes all leases', async () => {
      await leaseStore.save(testLease);
      await leaseStore.save({ ...testLease, leaseId: 'lease-2', leaseToken: 'token-2' });
      
      await leaseStore.clear();
      
      const all = leaseStore.getAll();
      expect(all).toHaveLength(0);
    });

    test('cleanupExpired marks old leases as expired', async () => {
      const now = Date.now();
      const expiredLease: StoredLease = {
        ...testLease,
        leaseId: 'old-lease',
        expiresAt: now - 10000,
        status: 'active',
      };
      
      await leaseStore.save(expiredLease);
      const count = await leaseStore.cleanupExpired();
      
      expect(count).toBe(1);
      expect(leaseStore.get('old-lease')?.status).toBe('expired');
    });

    test('cleanupExpired preserves terminal lease statuses', async () => {
      const expiredAt = Date.now() - 1000;
      await leaseStore.save({ ...testLease, leaseId: 'final', status: 'finalized', expiresAt: expiredAt });
      await leaseStore.save({ ...testLease, leaseId: 'cancelled', status: 'cancelled', expiresAt: expiredAt });

      expect(await leaseStore.cleanupExpired()).toBe(0);
      expect(leaseStore.get('final')?.status).toBe('finalized');
      expect(leaseStore.get('cancelled')?.status).toBe('cancelled');
    });

    test('initialize propagates storage read failures', async () => {
      const failure = new Error('corrupt lease storage');
      class FailingStorage extends MockStorageAdapter {
        override async get<T>(_key: string): Promise<T | null> {
          throw failure;
        }
      }

      const store = new LeaseStore(new FailingStorage(), logger);
      await expect(store.initialize()).rejects.toBe(failure);
      expect(store.isInitialized()).toBe(false);
    });

    test('persistence omits explicitly undefined optional fields', async () => {
      await leaseStore.save({ ...testLease, treeId: undefined, txId: undefined });

      const persisted = storage.getSnapshot().parity_test_leases as StoredLease[];
      expect(persisted[0]).not.toHaveProperty('treeId');
      expect(persisted[0]).not.toHaveProperty('txId');
    });

    test('serialized mutations keep memory and storage consistent after a failure', async () => {
      class DelayedFailStorage extends MockStorageAdapter {
        failNextSet = false;

        override async set<T>(key: string, value: T): Promise<void> {
          if (this.failNextSet) {
            this.failNextSet = false;
            throw new Error('injected set failure');
          }
          await super.set(key, value);
        }
      }

      const delayed = new DelayedFailStorage();
      const store = new LeaseStore(delayed, logger, { storageKey: 'concurrent_test' });
      const leases = [
        { ...testLease, leaseId: 'c-1', leaseToken: 't-1' },
        { ...testLease, leaseId: 'c-2', leaseToken: 't-2' },
      ];

      delayed.failNextSet = true;
      const results = await Promise.allSettled([
        store.save(leases[0]),
        store.save(leases[1]),
      ]);
      expect(results[0].status).toBe('rejected');
      expect(results[1].status).toBe('fulfilled');

      expect(store.get('c-1')).toBeUndefined();
      expect(store.get('c-2')?.leaseId).toBe('c-2');

      const reopened = new LeaseStore(delayed, logger, { storageKey: 'concurrent_test' });
      await reopened.initialize();
      expect(reopened.get('c-1')).toBeUndefined();
      expect(reopened.get('c-2')?.leaseId).toBe('c-2');
    });
  });

  describe('TTL Calculations', () => {
    test('getMinimumTTL returns smallest TTL among active leases', async () => {
      const now = Date.now();
      const lease1: StoredLease = {
        leaseId: 'lease-1',
        leaseToken: 'token-1',
        indices: { addressIndex: 0, l1: 0, l2: 0 },
        status: 'active' as LeaseStatus,
        createdAt: now,
        leaseTTL: 10000,
        expiresAt: now + 500000,
      };
      const lease2: StoredLease = {
        leaseId: 'lease-2',
        leaseToken: 'token-2',
        indices: { addressIndex: 0, l1: 0, l2: 1 },
        status: 'active' as LeaseStatus,
        createdAt: now,
        leaseTTL: 5000,
        expiresAt: now + 500000,
      };
      
      await leaseStore.save(lease1);
      await leaseStore.save(lease2);
      
      expect(leaseStore.getMinimumTTL()).toBe(5000);
    });

    test('getMinimumTTL returns null when no active leases', async () => {
      expect(leaseStore.getMinimumTTL()).toBeNull();
    });

    test('calculateMonitoringInterval respects TTL bounds', async () => {
      const now = Date.now();
      const shortTTL: StoredLease = {
        ...testLease,
        leaseTTL: 8000,
        expiresAt: now + 8000,
      };
      
      await leaseStore.save(shortTTL);
      
      const interval = leaseStore.calculateMonitoringInterval();
      expect(interval).toBeGreaterThanOrEqual(1000);
      expect(interval).toBeLessThanOrEqual(5000);
    });
  });
});
