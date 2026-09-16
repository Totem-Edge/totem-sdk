import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { LocalFileBackend } from '../artifacts/backends/local-fs-backend.js';
import { ArtifactStore } from '../artifacts/artifact-store.js';
import { MemoryStore } from '../adapters/memory-store.js';
import { runBackendConformance } from '../conformance/backend-harness.js';

function tempDir(): string {
  return `${join(tmpdir(), `totemsdk-artifacts-${process.pid}-${Math.random().toString(36).slice(2)}`)}`;
}

runBackendConformance('LocalFileBackend (backend conformance)', async () => {
  const dir = tempDir();
  await fs.mkdir(dir, { recursive: true });
  return {
    backend: new LocalFileBackend(dir),
    cleanup: async () => fs.rm(dir, { recursive: true, force: true }),
  };
});

describe('ArtifactStore', () => {
  let dir: string;
  let backend: LocalFileBackend;
  let index: MemoryStore;
  let store: ArtifactStore;

  beforeEach(async () => {
    dir = tempDir();
    await fs.mkdir(dir, { recursive: true });
    backend = new LocalFileBackend(dir);
    index = new MemoryStore();
    store = new ArtifactStore(backend, { index });
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('returns a receipt with the committed digest and size', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const receipt = await store.put('evidence', bytes);
    expect(receipt.size).toBe(4);
    expect(receipt.ref.algorithm).toBe('sha3-256');
    expect(receipt.ref.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('reads back bytes matching the digest', async () => {
    const bytes = new Uint8Array([9, 8, 7]);
    const { ref } = await store.put('evidence', bytes);
    const read = await store.get(ref);
    expect(read.status).toBe('ok');
    expect(Buffer.from(read.bytes!).toString('hex')).toBe(Buffer.from(bytes).toString('hex'));
  });

  it('returns not-found for unknown refs', async () => {
    const read = await store.get({ namespace: 'x', algorithm: 'sha3-256', digest: 'ab'.repeat(32) });
    expect(read.status).toBe('not-found');
  });

  it('reports corrupt on tampered bytes (digest verification)', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const { ref } = await store.put('evidence', bytes);

    const nsHex = Buffer.from('evidence', 'utf8').toString('hex');
    const file = join(dir, `${nsHex}.${ref.digest}.art`);
    await fs.writeFile(file, Buffer.from('tampered'));

    const read = await store.get(ref);
    expect(read.status).toBe('corrupt');
  });

  it('records an index entry on put and removes it on delete', async () => {
    const bytes = new Uint8Array([1]);
    const { ref } = await store.put('evidence', bytes, { metadata: { owner: 'test' } });

    const entries = await store.list();
    expect(entries).toHaveLength(1);
    expect(entries[0].ref.digest).toBe(ref.digest);
    expect(entries[0].owner).toBe('test');

    await store.delete(ref);
    expect(await store.list()).toHaveLength(0);
  });

  it('refuses to write to a non-writable backend', async () => {
    const readOnly = new ArtifactStore({
      capabilities: { writable: false, acknowledge: 'volatile', atomic: false, retention: 'none', offlineReadable: true },
      get: async () => ({ status: 'not-found' as const }),
      put: async () => { throw new Error('should not be called'); },
    });
    await expect(readOnly.put('x', new Uint8Array([1]))).rejects.toMatchObject({ code: 'unavailable' });
  });
});