/**
 * RFC-057 D8/D12 — real Hypercore/Hyperbee coverage (no mocked bee).
 *
 * Node is the CI proxy for Bare; the same real replication path is exercised by
 * src/__tests__/bare/hyperbee.bare.mjs.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BareKVStore } from '../storage/BareKVStore';

async function loadHolepunch(): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Hypercore: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Hyperbee: any;
}> {
  const [{ default: Hypercore }, { default: Hyperbee }] = await Promise.all([
    import('hypercore' as string),
    import('hyperbee' as string),
  ]) as [{ default: unknown }, { default: unknown }];
  return { Hypercore, Hyperbee };
}

async function waitFor(check: () => Promise<boolean>, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`waitFor: condition not met within ${timeoutMs}ms`);
}

describe('BareKVStore over real Hyperbee', () => {
  const dirs: string[] = [];
  const makeDir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'pear-hyperbee-'));
    dirs.push(dir);
    return dir;
  };

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('persists and reopens a real Hypercore/Hyperbee store', async () => {
    const storagePath = join(makeDir(), 'kv');

    const first = new BareKVStore({ storagePath });
    await first.set('count', 7n);
    await first.set('payload', new Uint8Array([1, 2, 3]));
    await first.close();

    const reopened = new BareKVStore({ storagePath });
    expect(await reopened.get('count')).toBe(7n);
    expect(await reopened.get('payload')).toEqual(new Uint8Array([1, 2, 3]));
    await reopened.close();
  });

  it('replicates values between two real peers', async () => {
    const { Hypercore, Hyperbee } = await loadHolepunch();
    const dirA = makeDir();
    const dirB = makeDir();

    const coreA = new Hypercore(join(dirA, 'core'));
    await coreA.ready();
    const coreB = new Hypercore(join(dirB, 'core'), coreA.key);

    const streamA = coreA.replicate(true);
    const streamB = coreB.replicate(false);
    streamA.pipe(streamB).pipe(streamA);

    const beeA = new Hyperbee(coreA, { keyEncoding: 'utf-8', valueEncoding: 'binary' });
    const beeB = new Hyperbee(coreB, { keyEncoding: 'utf-8', valueEncoding: 'binary' });
    await beeA.ready();
    await beeB.ready();

    const storeA = new BareKVStore({ _bee: beeA });
    const storeB = new BareKVStore({ _bee: beeB });

    await storeA.set('bigint', 42n);
    await storeA.set('bytes', new Uint8Array([9, 8, 7]));

    await waitFor(() => storeB.has('bigint'));

    expect(await storeB.get('bigint')).toBe(42n);
    expect(await storeB.get('bytes')).toEqual(new Uint8Array([9, 8, 7]));

    await storeA.close();
    await storeB.close();
  });
});
