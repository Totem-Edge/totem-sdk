import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { FileStore } from '../adapters/file-store.js';
import { runCoreConformance } from '../conformance/harness.js';

function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = `${join(tmpdir(), `totemsdk-filestore-${process.pid}-${Math.random().toString(36).slice(2)}`)}`;
  return (async () => {
    await fs.mkdir(dir, { recursive: true });
    try {
      return await fn(dir);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  })();
}

runCoreConformance('FileStore (conformance, strict)', () => withTempDir(async (dir) => new FileStore(dir, { failurePolicy: 'strict' })));

describe('FileStore corrupt handling', () => {
  it('reports corrupt (never collapses into absence) under strict policy', async () => {
    await withTempDir(async (dir) => {
      const store = new FileStore(dir, { failurePolicy: 'strict' });
      const key = 'broken';
      const hex = Buffer.from(key, 'utf8').toString('hex');
      await fs.writeFile(join(dir, `${hex}.bin`), 'this is not a codec record');
      await expect(store.get(key)).rejects.toMatchObject({ code: 'corrupt' });
    });
  });

  it('treats corrupt records as absent under lenient policy', async () => {
    await withTempDir(async (dir) => {
      const store = new FileStore(dir, { failurePolicy: 'lenient' });
      const key = 'broken';
      const hex = Buffer.from(key, 'utf8').toString('hex');
      await fs.writeFile(join(dir, `${hex}.bin`), 'this is not a codec record');
      expect(await store.get(key)).toBeNull();
    });
  });

  it('treats missing files as null, not corrupt', async () => {
    await withTempDir(async (dir) => {
      const store = new FileStore(dir, { failurePolicy: 'strict' });
      expect(await store.get('nope')).toBeNull();
    });
  });

  it('survives a reopen and reads back committed data', async () => {
    await withTempDir(async (dir) => {
      const first = new FileStore(dir);
      await first.set('persist', { k: 1n });
      await first.set('bytes', new Uint8Array([9, 8]));
      const second = new FileStore(dir);
      expect(await second.get('persist')).toEqual({ k: 1n });
      const bytes = await second.get<Uint8Array>('bytes');
      expect(Buffer.from(bytes!).toString('hex')).toBe('0908');
    });
  });

  it('enforces no-silent-downgrade via assertCapabilities', async () => {
    await withTempDir(async (dir) => {
      const store = new FileStore(dir);
      const { assertCapabilities } = await import('../types.js');
      expect(() => assertCapabilities(store, { acknowledge: 'durably-acknowledged' })).not.toThrow();
      expect(() => assertCapabilities(store, { atomic: true })).toThrow(/atomic/);
    });
  });

  it('does not lose concurrent conditional updates (AUD-033 in-process)', async () => {
    await withTempDir(async (dir) => {
      const store = new FileStore(dir);
      await store.set('counter', 0);
      const results = await Promise.all([
        store.conditionalUpdate<number>('counter', (v) => ({ next: (v ?? 0) + 1 })),
        store.conditionalUpdate<number>('counter', (v) => ({ next: (v ?? 0) + 1 })),
        store.conditionalUpdate<number>('counter', (v) => ({ next: (v ?? 0) + 1 })),
        store.conditionalUpdate<number>('counter', (v) => ({ next: (v ?? 0) + 1 })),
      ]);
      const applied = results.filter((r) => r.applied);
      // Seeded at 0: every applied increment is exactly one transition.
      expect(await store.get('counter')).toBe(applied.length);
      const revisions = applied.map((r) => r.revision).sort((a, b) => a - b);
      expect(new Set(revisions).size).toBe(revisions.length);
    });
  });

  it('does not lose concurrent conditional updates across separate FileStore instances (AUD-033)', async () => {
    await withTempDir(async (dir) => {
      const a = new FileStore(dir);
      const b = new FileStore(dir);
      await a.set('counter', 0);
      const results = await Promise.all([
        a.conditionalUpdate<number>('counter', (v) => ({ next: (v ?? 0) + 1 })),
        b.conditionalUpdate<number>('counter', (v) => ({ next: (v ?? 0) + 1 })),
        a.conditionalUpdate<number>('counter', (v) => ({ next: (v ?? 0) + 1 })),
        b.conditionalUpdate<number>('counter', (v) => ({ next: (v ?? 0) + 1 })),
      ]);
      const applied = results.filter((r) => r.applied);
      // Seeded at 0: every applied increment is exactly one transition.
      expect(await a.get('counter')).toBe(applied.length);
      const revisions = applied.map((r) => r.revision).sort((a, b) => a - b);
      expect(new Set(revisions).size).toBe(revisions.length);
    });
  });

  it('recovers after a simulated crashed holder (marker write skipped) and continues CAS', async () => {
    await withTempDir(async (dir) => {
      const store = new FileStore(dir, { lockStaleMs: 25 });
      await store.set('k', 0);

      // Simulate a holder that created the lock directory but never wrote the
      // marker (crashed between mkdir and marker): the lock looks stale.
      const hex = Buffer.from('k', 'utf8').toString('hex');
      await fs.mkdir(join(dir, `.locks-${hex}.bin`));

      // First attempt steals the marker-less stale lock; subsequent updates go
      // through the live lock. Short stale timeout makes each steal quick.
      const first = await store.conditionalUpdate<number>('k', (v) => ({ next: (v ?? 0) + 1 }));
      expect(first.applied).toBe(true);
      await store.conditionalUpdate<number>('k', (v) => ({ next: (v ?? 0) + 1 }));
      expect(await store.get('k')).toBe(2);
    });
  });

  it('does not lose concurrent conditional updates across separate processes (AUD-033)', async () => {
    expect(process.env.JEST_WORKER_ID).toBeDefined(); // runs under jest (node child)
    await withTempDir(async (dir) => {
      const store = new FileStore(dir);
      await store.set('counter', 0);

      const { spawn } = await import('node:child_process');
      const root = join(__dirname, '..', '..', '..', '..');
      const cjs = join(root, 'packages', 'storage', 'dist', 'adapters', 'file-store.js');
      const childSrc = `
        const { FileStore } = require(${JSON.stringify(cjs)});
        (async () => {
          const store = new FileStore(${JSON.stringify(dir)});
          const results = await Promise.all(
            [1, 2, 3, 4].map(() => store.conditionalUpdate('counter', (v) => ({ next: (v ?? 0) + 1 }))),
          );
          process.stdout.write(JSON.stringify(results.map((r) => ({ applied: r.applied, revision: r.revision }))));
        })().catch((err) => { console.error(err); process.exit(1); });
      `;
      const child = spawn(
        process.execPath,
        ['-e', childSrc],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
      const output = await new Promise<string>((resolve, reject) => {
        const chunks: string[] = [];
        const errChunks: string[] = [];
        child.stdout?.on('data', (c: Buffer) => chunks.push(c.toString()));
        child.stderr?.on('data', (c: Buffer) => errChunks.push(c.toString()));
        child.on('error', reject);
        child.on('exit', (code) => {
          if (code !== 0) reject(new Error(`child exited ${code}: ${errChunks.join('')}`));
          else resolve(chunks.join(''));
        });
      });

      const applied = JSON.parse(output.trim()).length;
      expect(applied).toBe(4);
      expect(await store.get('counter')).toBe(applied);
    });
  });
});