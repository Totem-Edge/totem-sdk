/**
 * Deterministic CAS/reopen property for FileStore.
 *
 * Multiple store instances contend on the same key; every acknowledged update
 * must be reflected exactly once and survive a reopen. No update may silently
 * disappear or duplicate a revision.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FileStore } from '../adapters/file-store.js';

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

function int(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

describe('FileStore CAS/reopen properties', () => {
  it('preserves every acknowledged increment across contention and reopen', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-cas-fuzz-'));
    const rng = mulberry32(0xca5);
    let stores = [new FileStore(dir), new FileStore(dir), new FileStore(dir)];
    await stores[0].set('counter', 0);

    let expected = 0;
    const revisions = new Set<number>();

    for (let round = 0; round < 15; round += 1) {
      if (round > 0 && round % 5 === 0) {
        stores = [new FileStore(dir), new FileStore(dir), new FileStore(dir)];
      }
      const updates = Array.from({ length: int(rng, 4, 8) }, (_, i) =>
        stores[i % stores.length].conditionalUpdate<number>('counter', (value) => ({
          next: (value ?? 0) + 1,
        })),
      );
      const results = await Promise.allSettled(updates);
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(rejected).toHaveLength(0);

      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        expect(result.value.applied).toBe(true);
        expect(revisions.has(result.value.revision)).toBe(false);
        revisions.add(result.value.revision);
        expected += 1;
      }

      expect(await stores[0].get<number>('counter')).toBe(expected);
    }

    const reopened = new FileStore(dir);
    expect(await reopened.get<number>('counter')).toBe(expected);

    fs.rmSync(dir, { recursive: true, force: true });
  }, 30_000);
});
