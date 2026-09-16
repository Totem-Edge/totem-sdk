import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import Database from 'better-sqlite3';

import { SqliteStore } from '../adapters/sqlite-store.js';
import { runCoreConformance } from '../conformance/harness.js';

let sqliteAvailable = true;
try {
  new Database(':memory:').close();
} catch {
  sqliteAvailable = false;
}

if (sqliteAvailable) {
  runCoreConformance('SqliteStore (conformance, :memory:)', async () => new SqliteStore(':memory:'));
} else {
  console.warn('@totemsdk/storage: better-sqlite3 unavailable — sqlite conformance skipped (optional run)');
}

describe('SqliteStore durability (file-backed)', () => {
  const dir = `${join(tmpdir(), `totemsdk-sqlite-${process.pid}-${Math.random().toString(36).slice(2)}`)}`;
  const available = sqliteAvailable;

  beforeAll(async () => {
    await fs.mkdir(dir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  if (!available) {
    it('skips when better-sqlite3 is unavailable', () => undefined);
    return;
  }

  it('is durably-acknowledged', async () => {
    const store = new SqliteStore(join(dir, 'a.db'));
    expect(store.capabilities.acknowledge).toBe('durably-acknowledged');
    await store.close();
  });

  it('persists across reopen', async () => {
    const path = join(dir, 'persist.db');
    const first = new SqliteStore(path);
    await first.set('k', { v: 1n, b: new Uint8Array([1, 2]) });
    await first.set('j', 7);
    await first.close();

    const second = new SqliteStore(path);
    expect(await second.get('k')).toEqual({ v: 1n, b: new Uint8Array([1, 2]) });
    expect(await second.get('j')).toBe(7);
    await second.close();
  });

  it('reports corrupt records (never absent) under strict policy', async () => {
    const path = join(dir, 'corrupt.db');
    const store = new SqliteStore(path);
    await store.set('clean', 'ok');
    const db = new Database(path);
    db.prepare('UPDATE totemsdk_kv SET value = ? WHERE key = ?').run(Buffer.from('garbage-not-a-codec-record'), 'clean');
    db.close();
    await expect(store.get('clean')).rejects.toMatchObject({ code: 'corrupt' });
    await store.close();
  });
});