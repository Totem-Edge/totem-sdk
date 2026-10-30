import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { codec } from '@totemsdk/storage/codec';
import { defineDataset } from '@totemsdk/replication';
import { openPearReplicatedIndex, openPearReplicatedLog } from '../replication.js';

const descriptor = defineDataset({
  datasetId: 'test.pear.replication',
  datasetVersion: 1,
  codecVersion: codec.version,
  writerModel: 'single-writer',
  encryptionProfile: 'none',
  retention: 'full',
});

describe('Pear replication factories', () => {
  it('opens a real Hypercore log and reads appended records', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pear-replication-'));
    try {
      const log = await openPearReplicatedLog<{ n: number }>({
        storagePath: join(dir, 'log'),
        descriptor,
      });
      await log.append({ n: 1 });
      await log.append({ n: 2 });
      const seen: number[] = [];
      for await (const entry of log.readSince()) seen.push(entry.record.n);
      expect(seen).toEqual([1, 2]);
      await log.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('opens a Hyperbee index', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pear-index-'));
    try {
      const index = await openPearReplicatedIndex({
        storagePath: join(dir, 'index'),
        descriptor,
      });
      expect(index.status().localHead).toBeNull();
      await index.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
