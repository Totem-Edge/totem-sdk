import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { SyncSqliteStore } from '../adapters/sync-sqlite-store.js';
import { SqliteStore } from '../adapters/sqlite-store.js';

function tempDb(): { dir: string; file: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'totem-sync-store-'));
  return { dir, file: path.join(dir, 'test.sqlite') };
}

describe('SyncSqliteStore', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    ({ dir, file } = tempDb());
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('round-trips bigint and bytes, and supports keys/remove', () => {
    const kv = new SyncSqliteStore(file);
    kv.set('a', { amount: 42n, bytes: new Uint8Array([1, 2, 3]) });
    kv.set('b', 'plain');
    expect(kv.get<{ amount: bigint; bytes: Uint8Array }>('a')).toEqual({
      amount: 42n,
      bytes: new Uint8Array([1, 2, 3]),
    });
    expect(kv.get('b')).toBe('plain');
    expect(kv.has('a')).toBe(true);
    expect(kv.keys()).toEqual(['a', 'b']);
    expect(kv.remove('a')).toBe(true);
    expect(kv.get('a')).toBeNull();
    kv.close();
  });

  it('rolls a transaction back on throw', () => {
    const kv = new SyncSqliteStore(file);
    expect(() =>
      kv.transaction(() => {
        kv.set('x', 1);
        throw new Error('nope');
      }),
    ).toThrow('nope');
    expect(kv.get('x')).toBeNull();
    kv.close();
  });

  it('is readable by the async SqliteStore (shared codec/envelope)', async () => {
    const kv = new SyncSqliteStore(file);
    kv.set('shared', { value: 7n });
    kv.close();
    const asyncStore = new SqliteStore(file);
    expect(await asyncStore.get('shared')).toEqual({ value: 7n });
    await asyncStore.close();
  });

  it('migrates a legacy relational table into KV and drops it', () => {
    const legacy = new Database(file);
    legacy.exec('CREATE TABLE legacy_items (id TEXT PRIMARY KEY, json TEXT NOT NULL)');
    legacy.prepare('INSERT INTO legacy_items (id, json) VALUES (?, ?)').run('1', '{"a":1}');
    legacy.prepare('INSERT INTO legacy_items (id, json) VALUES (?, ?)').run('2', '{"b":2}');
    legacy.close();

    const kv = new SyncSqliteStore(file);
    const migrated = kv.migrateLegacyTable<string>('legacy_items', (row) => ({
      key: `item:${String(row['id'])}`,
      value: String(row['json']),
    }));
    expect(migrated).toBe(2);
    expect(kv.get('item:1')).toBe('{"a":1}');
    expect(kv.get('item:2')).toBe('{"b":2}');
    expect(kv.tableExists('legacy_items')).toBe(false);
    kv.close();
  });
});
