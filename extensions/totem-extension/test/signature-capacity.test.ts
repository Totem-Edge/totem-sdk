/**
 * Tests for per-address WOTS signature capacity threshold logic.
 *
 * Task #84: Warn users when a connected dApp address is running low on
 * one-time signatures. Exercises the threshold classifier at 80%, 95%,
 * and 100% as well as the WatermarkStore integration.
 */

import {
  classifyCapacity,
  describeCapacityLevel,
  SIGNATURE_CAPACITY_PER_ADDRESS,
  SIGNATURE_CAPACITY_THRESHOLDS,
} from '../src/core/stores/signatureCapacity';
import { WatermarkStore } from '../src/core/stores/WatermarkStore';

describe('classifyCapacity threshold logic', () => {
  const TOTAL = SIGNATURE_CAPACITY_PER_ADDRESS;

  it('reports ok below the 80% threshold', () => {
    const result = classifyCapacity(Math.floor(TOTAL * 0.5));
    expect(result.level).toBe('ok');
    expect(result.percentage).toBeCloseTo(50, 1);
    expect(describeCapacityLevel(result.level)).toBe('');
  });

  it('reports ok just below 80%', () => {
    const justUnder = Math.floor(TOTAL * SIGNATURE_CAPACITY_THRESHOLDS.warning) - 1;
    const result = classifyCapacity(justUnder);
    expect(result.level).toBe('ok');
  });

  it('crosses into warning exactly at 80%', () => {
    const at80 = Math.ceil(TOTAL * SIGNATURE_CAPACITY_THRESHOLDS.warning);
    const result = classifyCapacity(at80);
    expect(result.level).toBe('warning');
    expect(result.percentage).toBeGreaterThanOrEqual(80);
    expect(result.percentage).toBeLessThan(95);
    expect(result.remaining).toBe(TOTAL - at80);
    expect(describeCapacityLevel(result.level)).toMatch(/80%/);
  });

  it('reports warning anywhere in [80%, 95%)', () => {
    const mid = Math.floor(TOTAL * 0.9);
    const result = classifyCapacity(mid);
    expect(result.level).toBe('warning');
  });

  it('crosses into critical exactly at 95%', () => {
    const at95 = Math.ceil(TOTAL * SIGNATURE_CAPACITY_THRESHOLDS.critical);
    const result = classifyCapacity(at95);
    expect(result.level).toBe('critical');
    expect(result.percentage).toBeGreaterThanOrEqual(95);
    expect(result.percentage).toBeLessThan(100);
    expect(describeCapacityLevel(result.level)).toMatch(/95%/);
  });

  it('reports critical anywhere in [95%, 100%)', () => {
    const result = classifyCapacity(TOTAL - 1);
    expect(result.level).toBe('critical');
    expect(result.remaining).toBe(1);
  });

  it('reports exhausted at 100%', () => {
    const result = classifyCapacity(TOTAL);
    expect(result.level).toBe('exhausted');
    expect(result.percentage).toBe(100);
    expect(result.remaining).toBe(0);
    expect(describeCapacityLevel(result.level)).toMatch(/no remaining/i);
  });

  it('clamps usage above the budget to exhausted', () => {
    const result = classifyCapacity(TOTAL * 2);
    expect(result.level).toBe('exhausted');
    expect(result.used).toBe(TOTAL);
    expect(result.remaining).toBe(0);
  });

  it('handles zero usage', () => {
    const result = classifyCapacity(0);
    expect(result.level).toBe('ok');
    expect(result.remaining).toBe(TOTAL);
  });
});

describe('WatermarkStore.getAddressCapacity', () => {
  let storage: Record<string, any>;
  let store: WatermarkStore;

  beforeEach(() => {
    storage = {};
    (global as any).chrome = {
      storage: {
        local: {
          get: jest.fn().mockImplementation((key: string) => {
            return Promise.resolve(key in storage ? { [key]: storage[key] } : {});
          }),
          set: jest.fn().mockImplementation((obj: Record<string, any>) => {
            Object.assign(storage, obj);
            return Promise.resolve();
          }),
          remove: jest.fn().mockImplementation((key: string) => {
            delete storage[key];
            return Promise.resolve();
          }),
        },
      },
    };
    store = new WatermarkStore();
  });

  it('returns ok with full budget for an unused address', async () => {
    await store.initialize();
    const cap = store.getAddressCapacity(0);
    expect(cap.level).toBe('ok');
    expect(cap.used).toBe(0);
    expect(cap.total).toBe(SIGNATURE_CAPACITY_PER_ADDRESS);
  });

  it('reports warning when watermark crosses 80%', async () => {
    await store.initialize();
    const state = store.getCurrent()!;
    // 80% of 4096 = 3277 leaves used → next_l1=51, next_l2=13
    const used = Math.ceil(SIGNATURE_CAPACITY_PER_ADDRESS * 0.8);
    state.addresses[0].next_l1 = Math.floor(used / 64);
    state.addresses[0].next_l2 = used % 64;
    await store.save(state);

    const cap = store.getAddressCapacity(0);
    expect(cap.level).toBe('warning');
    expect(cap.used).toBe(used);
  });

  it('reports critical when watermark crosses 95%', async () => {
    await store.initialize();
    const state = store.getCurrent()!;
    const used = Math.ceil(SIGNATURE_CAPACITY_PER_ADDRESS * 0.95);
    state.addresses[1].next_l1 = Math.floor(used / 64);
    state.addresses[1].next_l2 = used % 64;
    await store.save(state);

    const cap = store.getAddressCapacity(1);
    expect(cap.level).toBe('critical');
    expect(cap.used).toBe(used);
  });

  it('reports exhausted when address budget is fully consumed', async () => {
    await store.initialize();
    const state = store.getCurrent()!;
    state.addresses[2].next_l1 = 64;
    state.addresses[2].next_l2 = 0;
    await store.save(state);

    const cap = store.getAddressCapacity(2);
    expect(cap.level).toBe('exhausted');
    expect(cap.used).toBe(SIGNATURE_CAPACITY_PER_ADDRESS);
    expect(cap.remaining).toBe(0);
  });
});
