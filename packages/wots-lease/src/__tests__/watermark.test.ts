import { WotsWatermarkStore, flatIndex, fromFlatIndex } from '../watermark';
import { WatermarkMonotonicityError, WatermarkExhaustedError } from '../errors';
import { LocalLeaseProvider } from '../local';
import { allocateDeviceRange } from '../device';
import type { StorageAdapter } from '@totemsdk/core';

function makeMemStorage(): StorageAdapter {
  const store = new Map<string, unknown>();
  return {
    get: async <T>(key: string) => (store.has(key) ? (store.get(key) as T) : null),
    set: async <T>(key: string, value: T) => { store.set(key, value); },
    remove: async (key: string) => { const had = store.has(key); store.delete(key); return had; },
    clear: async () => { store.clear(); },
    keys: async () => Array.from(store.keys()),
    has: async (key: string) => store.has(key),
  };
}

describe('flatIndex / fromFlatIndex', () => {
  it('round-trips', () => {
    const cases = [
      { addressIndex: 0, l1: 0, l2: 0 },
      { addressIndex: 0, l1: 0, l2: 63 },
      { addressIndex: 0, l1: 63, l2: 63 },
      { addressIndex: 63, l1: 63, l2: 63 },
      { addressIndex: 5, l1: 12, l2: 37 },
    ];
    for (const idx of cases) {
      expect(fromFlatIndex(flatIndex(idx))).toEqual(idx);
    }
  });

  it('total capacity is 64^3 = 262144', () => {
    expect(flatIndex({ addressIndex: 63, l1: 63, l2: 63 })).toBe(262143);
  });
});

describe('WotsWatermarkStore', () => {
  it('initializes empty on first use', async () => {
    const store = new WotsWatermarkStore(makeMemStorage());
    await store.initialize();
    const wm = store.getLocalWatermark('tree1');
    expect(wm.addressCursor).toBe(0);
    expect(wm.l1Cursor).toBe(0);
    expect(wm.l2Cursor).toBe(0);
    expect(wm.unavailableCount).toBe(0);
    expect(wm.capacity).toBe(262144);
  });

  it('getNextIndices returns cursor position', async () => {
    const store = new WotsWatermarkStore(makeMemStorage());
    await store.initialize();
    const idx = store.getNextIndices('tree1');
    expect(idx).toEqual({ addressIndex: 0, l1: 0, l2: 0 });
  });

  it('markUnavailable advances cursor and records reason', async () => {
    const store = new WotsWatermarkStore(makeMemStorage());
    await store.initialize();
    await store.markUnavailable('tree1', { addressIndex: 0, l1: 0, l2: 0 }, 'committed');
    const next = store.getNextIndices('tree1');
    expect(next).toEqual({ addressIndex: 0, l1: 0, l2: 1 });
    expect(store.isUnavailable('tree1', { addressIndex: 0, l1: 0, l2: 0 })).toBe(true);
    expect(store.isUnavailable('tree1', { addressIndex: 0, l1: 0, l2: 1 })).toBe(false);
  });

  it('migrates v1 flat state automatically', async () => {
    const storage = makeMemStorage();
    await storage.set('totem_wots_watermark', {
      next_addressIndex: 0,
      next_l1: 0,
      next_l2: 3,
      usedIndices: [[0, 0, 0], [0, 0, 1], [0, 0, 2]],
    });
    const store = new WotsWatermarkStore(storage);
    await store.initialize();
    const wm = store.getLocalWatermark('default');
    expect(wm.unavailableCount).toBe(3);
  });

  it('migrates v2 per-address state automatically', async () => {
    const storage = makeMemStorage();
    await storage.set('totem_wots_watermark', {
      version: 2,
      addresses: {
        0: { next_l1: 0, next_l2: 2, usedIndices: [[0, 0], [0, 1]] },
      },
    });
    const store = new WotsWatermarkStore(storage);
    await store.initialize();
    const wm = store.getLocalWatermark('default');
    expect(wm.unavailableCount).toBe(2);
  });

  it('throws WatermarkMonotonicityError if cursor decreases', async () => {
    const store = new WotsWatermarkStore(makeMemStorage());
    await store.initialize();
    await store.markUnavailable('t', { addressIndex: 0, l1: 0, l2: 5 }, 'committed');
    await expect(
      store.save('t', { addressCursor: 0, l1Cursor: 0, l2Cursor: 0, unavailable: {} }),
    ).rejects.toThrow(WatermarkMonotonicityError);
  });

  it('throws WatermarkMonotonicityError if unavailable map shrinks', async () => {
    const store = new WotsWatermarkStore(makeMemStorage());
    await store.initialize();
    await store.markUnavailable('t', { addressIndex: 0, l1: 0, l2: 0 }, 'committed');
    await expect(
      store.save('t', { addressCursor: 0, l1Cursor: 0, l2Cursor: 1, unavailable: {} }),
    ).rejects.toThrow(WatermarkMonotonicityError);
  });
});

describe('LocalLeaseProvider', () => {
  it('reserves and commits successfully', async () => {
    const provider = new LocalLeaseProvider(makeMemStorage());
    await provider.initialize();

    const reservation = await provider.reserveKeyUse({ treeId: 'wallet' });
    expect(reservation.reservationId).toBeTruthy();
    expect(reservation.indices).toEqual({ addressIndex: 0, l1: 0, l2: 0 });

    await provider.commitKeyUse(reservation.reservationId, '0xTXID');

    const wm = await provider.getLocalWatermark('wallet');
    expect(wm.unavailableCount).toBe(1);
  });

  it('burns reservation — marks index permanently unavailable', async () => {
    const storage = makeMemStorage();
    const provider = new LocalLeaseProvider(storage);
    await provider.initialize();

    const reservation = await provider.reserveKeyUse({ treeId: 'wallet' });
    await provider.burnReservation(reservation.reservationId, 'test burn');

    const store = new WotsWatermarkStore(storage);
    await store.initialize();
    expect(store.isUnavailable('wallet', reservation.indices)).toBe(true);
  });

  it('two consecutive reserves yield different indices', async () => {
    const provider = new LocalLeaseProvider(makeMemStorage());
    await provider.initialize();

    const r1 = await provider.reserveKeyUse({ treeId: 'wallet' });
    await provider.commitKeyUse(r1.reservationId, '0xA');
    const r2 = await provider.reserveKeyUse({ treeId: 'wallet' });

    expect(flatIndex(r2.indices)).toBeGreaterThan(flatIndex(r1.indices));
  });

  it('syncLeaseJournal returns synced:true (local no-op)', async () => {
    const provider = new LocalLeaseProvider(makeMemStorage());
    await provider.initialize();
    const result = await provider.syncLeaseJournal();
    expect(result.synced).toBe(true);
  });

  it('verifyLeaseCertificate returns true when cert is undefined', async () => {
    const provider = new LocalLeaseProvider(makeMemStorage());
    await provider.initialize();
    expect(await provider.verifyLeaseCertificate(undefined)).toBe(true);
  });

  it('verifyLeaseCertificate returns false for external cert', async () => {
    const provider = new LocalLeaseProvider(makeMemStorage());
    await provider.initialize();
    const cert = {
      reservationId: 'r1',
      treeId: 'wallet',
      indices: { addressIndex: 0, l1: 0, l2: 0 },
      issuedBy: 'external-key',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 120000,
      signature: 'sig',
    };
    expect(await provider.verifyLeaseCertificate(cert)).toBe(false);
  });
});

describe('allocateDeviceRange', () => {
  it('slot 0 gets addressIndex 0–7', () => {
    const range = allocateDeviceRange({ deviceSlot: 0, deviceId: 'phone' });
    expect(range.startAddressIndex).toBe(0);
    expect(range.endAddressIndex).toBe(7);
    expect(range.addressCount).toBe(8);
  });

  it('slot 3 gets addressIndex 24–31', () => {
    const range = allocateDeviceRange({ deviceSlot: 3, deviceId: 'pear' });
    expect(range.startAddressIndex).toBe(24);
    expect(range.endAddressIndex).toBe(31);
  });

  it('throws on out-of-range slot', () => {
    expect(() => allocateDeviceRange({ deviceSlot: 8, deviceId: 'x' })).toThrow(RangeError);
    expect(() => allocateDeviceRange({ deviceSlot: -1, deviceId: 'x' })).toThrow(RangeError);
  });
});
