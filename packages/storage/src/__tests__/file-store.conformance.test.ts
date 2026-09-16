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
});