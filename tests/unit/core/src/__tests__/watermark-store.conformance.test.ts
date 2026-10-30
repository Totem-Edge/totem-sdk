/**
 * WatermarkStore persistence-consumer conformance (RFC-007 Phase 4).
 *
 * Proves the WOTS watermark's recovery guarantees over a strict, disk-backed
 * StorageAdapter:
 * - a reserved index range is never re-exposed across a simulated restart;
 * - a corrupt watermark record is surfaced (fail-closed), never silently
 *   discarded in a way that would re-expose used indices.
 */

import { DurableTestStorage, createTempDir } from '../../test/helpers/durable-test-storage.js';
import { WatermarkStore } from '../lease/WatermarkStore.js';

const DEFAULT_KEY = 'totem_wots_watermark';

describe('WatermarkStore — durability conformance', () => {
  let dir: string;
  let storage: DurableTestStorage;

  beforeEach(async () => {
    dir = await createTempDir();
    storage = new DurableTestStorage(dir);
  });

  afterEach(async () => {
    await storage.clear().catch(() => undefined);
  });

  it('fresh store initializes to the default next indices', async () => {
    const store = new WatermarkStore(storage);
    const state = await store.initialize();
    expect(state.next_addressIndex).toBe(0);
    expect(state.next_l1).toBe(0);
    expect(state.next_l2).toBe(0);
    expect(store.getNextIndices()).toEqual({ addressIndex: 0, l1: 0, l2: 0 });
  });

  it('preserves advanced watermark and used indices across a simulated restart', async () => {
    const first = new WatermarkStore(storage);
    await first.initialize();
    await first.markUsed({ addressIndex: 0, l1: 0, l2: 0 });
    await first.advanceWatermark({ addressIndex: 0, l1: 0, l2: 0 });

    const second = new WatermarkStore(new DurableTestStorage(dir));
    const state = await second.initialize();

    expect(state.next_addressIndex).toBe(0);
    expect(state.next_l1).toBe(0);
    expect(state.next_l2).toBe(1);
    expect(second.getNextIndices()).toEqual({ addressIndex: 0, l1: 0, l2: 1 });
    expect(state.usedIndices).toContainEqual([0, 0, 0]);
  });

  it('never re-exposes a used index range after restart', async () => {
    const first = new WatermarkStore(storage);
    await first.initialize();
    await first.markUsed({ addressIndex: 1, l1: 2, l2: 3 });

    const second = new WatermarkStore(new DurableTestStorage(dir));
    await second.initialize();
    const next = second.getNextIndices();
    expect(next).not.toEqual({ addressIndex: 1, l1: 2, l2: 3 });
    expect(second.getUsageStats().used).toBe(1);
  });

  it('surfaces a corrupt watermark record instead of silently resetting', async () => {
    const first = new WatermarkStore(storage);
    await first.initialize();
    await first.markUsed({ addressIndex: 4, l1: 4, l2: 4 });
    await first.advanceWatermark({ addressIndex: 4, l1: 4, l2: 4 });

    await storage.corrupt(DEFAULT_KEY);

    const second = new WatermarkStore(new DurableTestStorage(dir));
    await expect(second.initialize()).rejects.toThrow(/corrupt/);
    expect(second.isInitialized()).toBe(false);
  });

  it('does not clobber the corrupt record with a fresh default', async () => {
    const first = new WatermarkStore(storage);
    await first.initialize();
    await first.markUsed({ addressIndex: 0, l1: 0, l2: 0 });
    await storage.corrupt(DEFAULT_KEY);

    const second = new WatermarkStore(new DurableTestStorage(dir));
    await expect(second.initialize()).rejects.toThrow(/corrupt/);

    expect(await storage.has(DEFAULT_KEY)).toBe(true);
    expect(second.getNextIndices()).toBeNull();
  });

  it('persists markUsed idempotently across restarts', async () => {
    const first = new WatermarkStore(storage);
    await first.initialize();
    await first.markUsed({ addressIndex: 0, l1: 0, l2: 0 });
    await first.markUsed({ addressIndex: 0, l1: 0, l2: 0 });

    const second = new WatermarkStore(new DurableTestStorage(dir));
    await second.initialize();
    await second.markUsed({ addressIndex: 0, l1: 0, l2: 0 });
    expect(second.getUsageStats().used).toBe(1);
  });
});