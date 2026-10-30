import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { codec } from '@totemsdk/storage/codec';
import { defineDataset } from '@totemsdk/replication';
import { HyperbeeDistributedIndex } from '../hyperbee-index';

const descriptor = defineDataset({
  datasetId: 'test.index',
  datasetVersion: 1,
  codecVersion: codec.version,
  writerModel: 'single-writer',
  encryptionProfile: 'none',
  retention: 'full',
});

const dirs: string[] = [];
const makeDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'rep-bee-'));
  dirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function waitFor(check: () => boolean | Promise<boolean>, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('waitFor timed out');
}

describe('HyperbeeDistributedIndex', () => {
  it('reads values and survives reopen', async () => {
    const storagePath = join(makeDir(), 'bee');
    const index = await HyperbeeDistributedIndex.open({ storagePath, descriptor });
    await index.put('a', { n: 1n });
    await index.put('b', { n: 2n });
    expect(await index.get('a')).toEqual({ n: 1n });
    expect(await index.get('missing')).toBeNull();

    const keys: string[] = [];
    for await (const entry of index.list('a')) keys.push(entry.key);
    expect(keys).toEqual(['a']);
    await index.close();

    const reopened = await HyperbeeDistributedIndex.open({ storagePath, descriptor });
    expect(await reopened.get('b')).toEqual({ n: 2n });
    await reopened.close();
  });

  it('replicates an index to a read replica', async () => {
    const dirA = makeDir();
    const dirB = makeDir();
    const writer = await HyperbeeDistributedIndex.open({ storagePath: join(dirA, 'bee'), descriptor });
    const reader = await HyperbeeDistributedIndex.open({
      storagePath: join(dirB, 'bee'),
      key: writer.raw.feed.key,
      descriptor,
    });

    const s1 = writer.raw.feed.replicate(true);
    const s2 = reader.raw.feed.replicate(false);
    s1.pipe(s2).pipe(s1);

    await writer.put('k', { value: 42n });
    await waitFor(async () => (await reader.get('k')) !== null);
    expect(await reader.get('k')).toEqual({ value: 42n });

    await writer.close();
    await reader.close();
  });
});
