import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { codec } from '@totemsdk/storage/codec';
import { defineDataset } from '@totemsdk/replication';
import { HypercoreReplicatedLog } from '../hypercore-log';

const descriptor = defineDataset({
  datasetId: 'test.events',
  datasetVersion: 1,
  codecVersion: codec.version,
  writerModel: 'single-writer',
  encryptionProfile: 'none',
  retention: 'full',
});

const dirs: string[] = [];
const makeDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'rep-hc-'));
  dirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function waitFor(check: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('waitFor timed out');
}

describe('HypercoreReplicatedLog', () => {
  it('appends, reads by cursor, and survives reopen', async () => {
    const storagePath = join(makeDir(), 'log');
    const log = await HypercoreReplicatedLog.open<{ n: number }>({ storagePath, descriptor });
    await log.append({ n: 1 });
    const second = await log.append({ n: 2 });
    expect(second.length).toBe(2);

    const all: number[] = [];
    for await (const entry of log.readSince()) all.push(entry.record.n);
    expect(all).toEqual([1, 2]);

    const after: number[] = [];
    for await (const entry of log.readSince('hc:1')) after.push(entry.record.n);
    expect(after).toEqual([2]);
    expect(log.status().localHead).toBe('hc:2');
    await log.close();

    const reopened = await HypercoreReplicatedLog.open<{ n: number }>({ storagePath, descriptor });
    const replayed: number[] = [];
    for await (const entry of reopened.readSince()) replayed.push(entry.record.n);
    expect(replayed).toEqual([1, 2]);
    await reopened.close();
  });

  it('replicates a log to a read replica with a cursor', async () => {
    const dirA = makeDir();
    const dirB = makeDir();
    const writer = await HypercoreReplicatedLog.open<{ n: number }>({
      storagePath: join(dirA, 'log'),
      descriptor,
    });
    const reader = await HypercoreReplicatedLog.open<{ n: number }>({
      storagePath: join(dirB, 'log'),
      key: writer.raw.key,
      descriptor,
    });

    const s1 = writer.raw.replicate(true);
    const s2 = reader.raw.replicate(false);
    s1.pipe(s2).pipe(s1);

    await writer.append({ n: 10 });
    await writer.append({ n: 20 });
    await waitFor(() => Number(reader.raw.length) >= 2);

    const seen: number[] = [];
    for await (const entry of reader.readSince('hc:1')) seen.push(entry.record.n);
    expect(seen).toEqual([20]);

    await writer.close();
    await reader.close();
  });

  it('rejects a record written with an incompatible dataset version', async () => {
    const storagePath = join(makeDir(), 'log');
    const log = await HypercoreReplicatedLog.open<{ n: number }>({ storagePath, descriptor });
    await log.append({ n: 1 });
    await log.close();

    const incompatible = defineDataset({ ...descriptor, datasetVersion: 2 });
    const reopened = await HypercoreReplicatedLog.open<{ n: number }>({
      storagePath,
      descriptor: incompatible,
    });
    await expect((async () => {
      for await (const _ of reopened.readSince()) { /* consume */ }
    })()).rejects.toThrow(/unsupported dataset version/);
    await reopened.close();
  });
});
