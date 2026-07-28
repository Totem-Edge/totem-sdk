/**
 * WatermarkStore Parity Tests
 * Compares SDK WatermarkStore with expected behavior for migration safety
 */

import { WatermarkStore, type WatermarkState, type WotsIndices } from '../../src/lease';
import { MockStorageAdapter, MockLogger } from './test-utils';

describe('WatermarkStore Parity Tests', () => {
  let storage: MockStorageAdapter;
  let logger: MockLogger;
  let watermarkStore: WatermarkStore;

  beforeEach(() => {
    storage = new MockStorageAdapter();
    logger = new MockLogger();
    watermarkStore = new WatermarkStore(storage, logger, { storageKey: 'parity_test_watermark' });
  });

  afterEach(() => {
    storage.reset();
    logger.reset();
  });

  describe('Initialization', () => {
    test('getCurrent returns null when not initialized', () => {
      const state = watermarkStore.getCurrent();
      expect(state).toBeNull();
    });

    test('initialize creates default state', async () => {
      const state = await watermarkStore.initialize();
      
      expect(state).not.toBeNull();
      expect(state.next_addressIndex).toBe(0);
      expect(state.next_l1).toBe(0);
      expect(state.next_l2).toBe(0);
      expect(state.usedIndices).toEqual([]);
    });

    test('initialize loads existing state', async () => {
      const existingState: WatermarkState = {
        next_addressIndex: 1,
        next_l1: 2,
        next_l2: 3,
        usedIndices: [[0, 0, 0]],
      };
      await storage.set('parity_test_watermark', existingState);
      
      const state = await watermarkStore.initialize();
      
      expect(state.next_addressIndex).toBe(1);
      expect(state.next_l1).toBe(2);
      expect(state.next_l2).toBe(3);
    });
  });

  describe('Index Management', () => {
    test('getNextIndices returns current watermark', async () => {
      await watermarkStore.initialize();
      
      const indices = watermarkStore.getNextIndices();
      expect(indices).toEqual({ addressIndex: 0, l1: 0, l2: 0 });
    });

    test('advanceWatermark increments indices correctly', async () => {
      await watermarkStore.initialize();
      
      await watermarkStore.advanceWatermark({ addressIndex: 0, l1: 0, l2: 0 });
      
      const indices = watermarkStore.getNextIndices();
      expect(indices).toEqual({ addressIndex: 0, l1: 0, l2: 1 });
    });

    test('advanceWatermark handles l2 overflow', async () => {
      await watermarkStore.save({
        next_addressIndex: 0,
        next_l1: 0,
        next_l2: 63,
        usedIndices: [],
      });
      
      await watermarkStore.advanceWatermark({ addressIndex: 0, l1: 0, l2: 63 });
      
      const indices = watermarkStore.getNextIndices();
      expect(indices).toEqual({ addressIndex: 0, l1: 1, l2: 0 });
    });

    test('advanceWatermark handles l1 overflow', async () => {
      await watermarkStore.save({
        next_addressIndex: 0,
        next_l1: 63,
        next_l2: 63,
        usedIndices: [],
      });
      
      await watermarkStore.advanceWatermark({ addressIndex: 0, l1: 63, l2: 63 });
      
      const indices = watermarkStore.getNextIndices();
      expect(indices).toEqual({ addressIndex: 1, l1: 0, l2: 0 });
    });

    test('markUsed tracks used indices', async () => {
      await watermarkStore.initialize();
      
      await watermarkStore.markUsed({ addressIndex: 0, l1: 0, l2: 0 });
      
      const state = watermarkStore.getCurrent();
      expect(state?.usedIndices).toContainEqual([0, 0, 0]);
    });

    test('markUsed prevents duplicates', async () => {
      await watermarkStore.initialize();
      
      await watermarkStore.markUsed({ addressIndex: 0, l1: 0, l2: 0 });
      await watermarkStore.markUsed({ addressIndex: 0, l1: 0, l2: 0 });
      
      const state = watermarkStore.getCurrent();
      expect(state?.usedIndices).toHaveLength(1);
    });
  });

  describe('Exhaustion Detection', () => {
    test('isExhausted returns false when indices available', async () => {
      await watermarkStore.initialize();
      
      expect(watermarkStore.isExhausted()).toBe(false);
      expect(watermarkStore.hasAvailableIndices()).toBe(true);
    });

    test('isExhausted returns true when all indices used', async () => {
      await watermarkStore.save({
        next_addressIndex: 64,
        next_l1: 0,
        next_l2: 0,
        usedIndices: [],
      });
      
      expect(watermarkStore.isExhausted()).toBe(true);
      expect(watermarkStore.hasAvailableIndices()).toBe(false);
    });

    test('getNextIndices returns null when exhausted', async () => {
      await watermarkStore.save({
        next_addressIndex: 64,
        next_l1: 0,
        next_l2: 0,
        usedIndices: [],
      });
      
      expect(watermarkStore.getNextIndices()).toBeNull();
    });
  });

  describe('Server Sync', () => {
    test('updateFromServer advances local watermark', async () => {
      await watermarkStore.initialize();
      
      const result = await watermarkStore.updateFromServer({ addressIndex: 1, l1: 2, l2: 3 });
      
      expect(result.updated).toBe(true);
      expect(watermarkStore.getNextIndices()).toEqual({ addressIndex: 1, l1: 2, l2: 3 });
    });

    test('updateFromServer does not regress watermark', async () => {
      await watermarkStore.save({
        next_addressIndex: 5,
        next_l1: 0,
        next_l2: 0,
        usedIndices: [],
      });
      
      const result = await watermarkStore.updateFromServer({ addressIndex: 1, l1: 0, l2: 0 });
      
      expect(result.updated).toBe(false);
      expect(watermarkStore.getNextIndices()).toEqual({ addressIndex: 5, l1: 0, l2: 0 });
    });

    test('updateFromServer detects drift', async () => {
      await watermarkStore.initialize();
      
      const result = await watermarkStore.updateFromServer({ addressIndex: 0, l1: 0, l2: 5 });
      
      expect(result.drift).toBe(5);
    });
  });

  describe('Persistence', () => {
    test('state persists across store instances', async () => {
      await watermarkStore.initialize();
      await watermarkStore.advanceWatermark({ addressIndex: 0, l1: 0, l2: 0 });
      
      const watermarkStore2 = new WatermarkStore(storage, logger, { storageKey: 'parity_test_watermark' });
      await watermarkStore2.initialize();
      
      expect(watermarkStore2.getNextIndices()).toEqual({ addressIndex: 0, l1: 0, l2: 1 });
    });

    test('clear removes all state', async () => {
      await watermarkStore.initialize();
      await watermarkStore.advanceWatermark({ addressIndex: 0, l1: 0, l2: 0 });
      
      await watermarkStore.clear();
      
      expect(watermarkStore.getCurrent()).toBeNull();
      expect(watermarkStore.isInitialized()).toBe(false);
    });
  });

  describe('Usage Statistics', () => {
    test('getUsageStats returns correct counts', async () => {
      await watermarkStore.initialize();
      await watermarkStore.markUsed({ addressIndex: 0, l1: 0, l2: 0 });
      await watermarkStore.markUsed({ addressIndex: 0, l1: 0, l2: 1 });
      
      const stats = watermarkStore.getUsageStats();
      
      expect(stats.used).toBe(2);
      expect(stats.total).toBe(64 * 64 * 64);
      expect(stats.percentage).toBeCloseTo(2 / (64 * 64 * 64) * 100);
    });
  });
});
