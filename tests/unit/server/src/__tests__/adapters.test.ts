/**
 * FileStorageAdapter hardening tests (RFC-007 Phase 2).
 *
 * Covers the phase acceptance for `server.FileStorageAdapter`:
 *   - `corrupt`/`write-failed` surfaced when `strict` (never silent JSON null)
 *   - prefix-scoped `clear()`/`keys()` (shared directories safe by construction)
 *   - bigint/bytes round-trip through the shared codec
 */

import { FileStorageAdapter, MemoryStorageAdapter } from '../adapters/storage.js';
import { mkdtempSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'server-fsadapter-'));
}

describe('FileStorageAdapter', () => {
  it('round-trips bigint and bytes through the shared codec', async () => {
    const dir = tmpDir();
    const store = new FileStorageAdapter({ directory: dir });
    const value = { n: 123n, bytes: new Uint8Array([1, 2, 3]), nest: { m: 4n } };
    await store.set('k', value);
    const read = await store.get<typeof value>('k');
    expect(read).toEqual(value);
    expect(typeof read?.n).toBe('bigint');
    rmSync(dir, { recursive: true, force: true });
  });

  it('surfaces corrupt records in strict mode instead of returning null', async () => {
    const dir = tmpDir();
    const store = new FileStorageAdapter({ directory: dir });
    await store.set('good', 1);
    // Corrupt the backing file directly.
    const file = join(dir, `${Buffer.from('good', 'utf8').toString('hex')}.bin`);
    writeFileSync(file, 'not-a-codec-record');
    await expect(store.get('good')).rejects.toThrow();
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null for corrupt records in lenient mode', async () => {
    const dir = tmpDir();
    const store = new FileStorageAdapter({ directory: dir, failurePolicy: 'lenient' });
    await store.set('good', 1);
    const file = join(dir, `${Buffer.from('good', 'utf8').toString('hex')}.bin`);
    writeFileSync(file, 'not-a-codec-record');
    expect(await store.get('good')).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  it('scopes keys() and clear() to the configured prefix', async () => {
    const dir = tmpDir();
    const shared = new FileStorageAdapter({ directory: dir });
    const prefixed = new FileStorageAdapter({ directory: dir, prefix: 'ledger:' });
    await shared.set('other', 'x');
    await prefixed.set('a', 1);
    await prefixed.set('b', 2);

    expect((await prefixed.keys()).sort()).toEqual(['a', 'b']);
    expect(await shared.keys()).toContain('other');

    await prefixed.clear();
    expect(await prefixed.keys()).toEqual([]);
    expect(await shared.get('other')).toBe('x');
    rmSync(dir, { recursive: true, force: true });
  });

  it('has/remove/clear behave on a fresh directory', async () => {
    const dir = tmpDir();
    const store = new FileStorageAdapter({ directory: dir });
    expect(await store.has('k')).toBe(false);
    expect(await store.remove('k')).toBe(false);
    await store.set('a', 1);
    await store.set('b', 2);
    await store.clear();
    expect(await store.keys()).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('MemoryStorageAdapter', () => {
  it('round-trips arbitrary values', async () => {
    const store = new MemoryStorageAdapter();
    await store.set('k', { n: 1n });
    expect(await store.get('k')).toEqual({ n: 1n });
    expect(await store.remove('k')).toBe(true);
    expect(await store.get('k')).toBeNull();
  });
});
