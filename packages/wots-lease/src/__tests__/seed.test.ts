import { MemoryStore } from '@totemsdk/storage';
import { LocalLeaseProvider } from '../local.js';
import { flatIndex, fromFlatIndex } from '../watermark.js';
import { seedLeaseWatermark, exportLeaseWatermark } from '../seed.js';
import {
  WatermarkSeedRegressionError,
  WatermarkSeedRequiredError,
} from '../errors.js';
import type { OnchainWatermarkProvider } from '../onchain.js';
import type { WatermarkSeed } from '../types.js';

function cursorOf(w: { addressCursor: number; l1Cursor: number; l2Cursor: number }): number {
  return flatIndex({ addressIndex: w.addressCursor, l1: w.l1Cursor, l2: w.l2Cursor });
}

async function freshLocal(): Promise<LocalLeaseProvider> {
  const local = new LocalLeaseProvider(new MemoryStore());
  await local.initialize();
  return local;
}

describe('watermark export/seed', () => {
  it('exports a seed and restores it into a fresh store without reuse', async () => {
    const a = await freshLocal();
    await a.reserveKeyUse({ treeId: 'default' });
    await a.reserveKeyUse({ treeId: 'default' });
    const seed = await exportLeaseWatermark(a, 'default');
    expect(seed.version).toBe(1);
    expect(seed.unavailable?.length).toBeGreaterThan(0);

    const b = await freshLocal();
    await b.seedWatermark(seed);
    const watermark = await b.getLocalWatermark('default');
    expect(cursorOf(watermark)).toBeGreaterThanOrEqual(cursorOf(seed));

    // The next reservation on B must be past every leaf A consumed.
    const next = await b.reserveKeyUse({ treeId: 'default' });
    expect(flatIndex(next.indices)).toBeGreaterThanOrEqual(seed.unavailable?.[seed.unavailable.length - 1] ?? 0);
    expect(next.indices).not.toEqual({ addressIndex: 0, l1: 0, l2: 0 });
  });

  it('refuses to seed below the current cursor (fail closed)', async () => {
    const local = await freshLocal();
    await local.reserveKeyUse({ treeId: 'default' });
    const behind: WatermarkSeed = {
      version: 1, treeId: 'default', addressCursor: 0, l1Cursor: 0, l2Cursor: 0, unavailable: [],
    };
    await expect(local.seedWatermark(behind)).rejects.toBeInstanceOf(WatermarkSeedRegressionError);
  });
});

describe('seedLeaseWatermark', () => {
  it('fails closed when no source is supplied and the keyspace is not fresh', async () => {
    const local = await freshLocal();
    await expect(seedLeaseWatermark({ local, treeId: 'default' })).rejects.toBeInstanceOf(WatermarkSeedRequiredError);
  });

  it('permits a declared-fresh keyspace', async () => {
    const local = await freshLocal();
    const watermark = await seedLeaseWatermark({ local, treeId: 'default', fresh: true });
    expect(cursorOf(watermark)).toBe(0);
  });

  it('seeds from an operator high-water mark', async () => {
    const local = await freshLocal();
    const target = flatIndex({ addressIndex: 1, l1: 2, l2: 3 });
    const watermark = await seedLeaseWatermark({ local, treeId: 'default', operatorHighWaterMark: target });
    expect(cursorOf(watermark)).toBe(target);
  });

  it('picks the higher of exported and operator sources', async () => {
    const local = await freshLocal();
    const exported: WatermarkSeed = {
      version: 1, treeId: 'default', addressCursor: 2, l1Cursor: 0, l2Cursor: 0, unavailable: [],
    };
    const operator = 5;
    const watermark = await seedLeaseWatermark({ local, treeId: 'default', exported, operatorHighWaterMark: operator });
    expect(cursorOf(watermark)).toBe(Math.max(cursorOf(exported), operator));
  });

  it('advances the local watermark from the on-chain cursor', async () => {
    const local = await freshLocal();
    const remote = fromFlatIndex(flatIndex({ addressIndex: 3, l1: 1, l2: 1 }));
    const onchain = {
      async syncLeaseJournal() {
        await local.advanceToRemoteWatermark('default', {
          addressCursor: remote.addressIndex, l1Cursor: remote.l1, l2Cursor: remote.l2,
        });
        return { synced: true, conflicts: [] };
      },
    } as unknown as OnchainWatermarkProvider;

    const watermark = await seedLeaseWatermark({ local, treeId: 'default', onchain });
    expect(cursorOf(watermark)).toBe(flatIndex(remote));
  });
});
