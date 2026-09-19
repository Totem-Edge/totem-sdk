/**
 * LeaseStore persistence-consumer conformance (RFC-007 Phase 4).
 *
 * Proves lease recovery guarantees over a strict, disk-backed StorageAdapter:
 * - leases survive a simulated restart, including their expiry state;
 * - a corrupt lease record is surfaced (fail-closed);
 * - every mutator rolls back its in-memory state when a write fails.
 */

import { DurableTestStorage, createTempDir } from '../../test/helpers/durable-test-storage.js';
import type { StoredLease } from '../lease/LeaseStore.js';
import { LeaseStore } from '../lease/LeaseStore.js';

const DEFAULT_KEY = 'totem_wots_leases';

function makeLease(leaseId: string, status: StoredLease['status'] = 'active', expiresAt = Date.now() + 60000): StoredLease {
  return {
    leaseId,
    leaseToken: `token-${leaseId}`,
    indices: { addressIndex: 0, l1: 0, l2: 0 },
    expiresAt,
    status,
    createdAt: Date.now(),
    leaseTTL: 60000,
  };
}

describe('LeaseStore — durability conformance', () => {
  let dir: string;
  let storage: DurableTestStorage;

  beforeEach(async () => {
    dir = await createTempDir();
    storage = new DurableTestStorage(dir);
  });

  afterEach(async () => {
    await storage.clear().catch(() => undefined);
  });

  it('preserves leases across a simulated restart', async () => {
    const first = new LeaseStore(storage);
    await first.initialize();
    await first.save(makeLease('lease-1'));
    await first.save(makeLease('lease-2'));

    const second = new LeaseStore(new DurableTestStorage(dir));
    await second.initialize();

    expect(second.get('lease-1')?.leaseToken).toBe('token-lease-1');
    expect(second.get('lease-2')?.leaseToken).toBe('token-lease-2');
    expect(second.getActive().map((l) => l.leaseId).sort()).toEqual(['lease-1', 'lease-2']);
  });

  it('preserves final status transitions across a restart', async () => {
    const first = new LeaseStore(storage);
    await first.initialize();
    await first.save(makeLease('lease-1'));
    await first.updateStatus('lease-1', 'finalized');
    await first.delete('lease-1');

    const second = new LeaseStore(new DurableTestStorage(dir));
    await second.initialize();
    expect(second.get('lease-1')).toBeUndefined();
  });

  it('surfaces a corrupt lease record instead of silently dropping it', async () => {
    const first = new LeaseStore(storage);
    await first.initialize();
    await first.save(makeLease('lease-1'));

    await storage.corrupt(DEFAULT_KEY);

    const second = new LeaseStore(new DurableTestStorage(dir));
    await expect(second.initialize()).rejects.toThrow(/corrupt/);
    expect(second.isInitialized()).toBe(false);
  });

  it('rolls back memory when save fails to persist', async () => {
    const first = new LeaseStore(storage);
    await first.initialize();

    storage.failNextSet();
    await expect(first.save(makeLease('lease-rollback'))).rejects.toThrow(/injected/);
    expect(first.get('lease-rollback')).toBeUndefined();

    storage.repairSets();
    await first.save(makeLease('lease-rollback'));
    expect(first.get('lease-rollback')).toBeDefined();
  });

  it('rolls back memory when delete fails to persist', async () => {
    const first = new LeaseStore(storage);
    await first.initialize();
    await first.save(makeLease('lease-keep'));

    storage.failNextSet();
    await expect(first.delete('lease-keep')).rejects.toThrow(/injected/);
    expect(first.get('lease-keep')).toBeDefined();
  });

  it('rolls back memory when updateStatus fails to persist', async () => {
    const first = new LeaseStore(storage);
    await first.initialize();
    await first.save(makeLease('lease-update'));

    storage.failNextSet();
    await expect(first.updateStatus('lease-update', 'finalized')).rejects.toThrow(/injected/);
    expect(first.get('lease-update')?.status).toBe('active');
  });

  it('persists cleanupExpired so reopens keep leases expired', async () => {
    const first = new LeaseStore(storage);
    await first.initialize();
    await first.save(makeLease('expired-lease', 'active', Date.now() - 1000));

    const expired = await first.cleanupExpired();
    expect(expired).toBe(1);
    expect(first.get('expired-lease')?.status).toBe('expired');

    const second = new LeaseStore(new DurableTestStorage(dir));
    await second.initialize();
    expect(second.get('expired-lease')?.status).toBe('expired');
    expect(second.getActive().map((l) => l.leaseId)).not.toContain('expired-lease');
  });
});