/**
 * @module @totemsdk/storage/sqlite-sync
 *
 * Synchronous `better-sqlite3` key-value adapter for consumers whose runtime
 * contract is synchronous (notably `@totemsdk/omnia`'s `ChannelStore` Map).
 *
 * This is the same on-disk format as `@totemsdk/storage/sqlite`
 * (`totemsdk_kv` with the versioned `codec` envelope `{k,v,r}`), so a value
 * written here can be read by `SqliteStore` and vice versa. It deliberately
 * lives in its own subpath: the neutral `@totemsdk/storage` entry never imports
 * native `better-sqlite3`.
 *
 * Durability: WAL + `synchronous = FULL`, writes are committed before `set`
 * returns.
 */

import Database from 'better-sqlite3';
import { codec } from '../codec.js';
import { StorageError } from '../errors.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS totemsdk_kv (
    key      TEXT PRIMARY KEY,
    value    BLOB NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1
  );
`;

interface KvRow {
  value: Buffer;
  revision: number;
}

export interface SyncSqliteStoreOptions {
  /** WAL journal mode (default true). */
  readonly wal?: boolean;
  /** busy_timeout in ms (default 5000). */
  readonly busyTimeoutMs?: number;
  /** Create the internal totemsdk_kv table (default true). */
  readonly createKvTable?: boolean;
}

/** A synchronous key-value handle with the shared storage codec/envelope. */
export class SyncSqliteStore {
  private readonly db: Database.Database;

  constructor(path = ':memory:', options: SyncSqliteStoreOptions = {}) {
    this.db = new Database(path);
    this.db.pragma(`journal_mode = ${options.wal === false ? 'DELETE' : 'WAL'}`);
    this.db.pragma('synchronous = FULL');
    this.db.pragma(`busy_timeout = ${options.busyTimeoutMs ?? 5000}`);
    if (options.createKvTable !== false) this.db.exec(SCHEMA);
  }

  get<T>(key: string): T | null {
    const row = this.db
      .prepare('SELECT value, revision FROM totemsdk_kv WHERE key = ?')
      .get(key) as KvRow | undefined;
    if (!row) return null;
    let envelope: { k: string; v: T; r: number };
    try {
      envelope = codec.deserialize(new Uint8Array(row.value)) as { k: string; v: T; r: number };
    } catch (err) {
      throw new StorageError(
        err instanceof StorageError ? err.message : 'corrupt record',
        'corrupt',
        { key, cause: err },
      );
    }
    if (envelope.k !== key) {
      throw new StorageError('envelope key mismatch', 'corrupt', { key });
    }
    return envelope.v;
  }

  set<T>(key: string, value: T): void {
    const bytes = Buffer.from(codec.serialize({ k: key, v: value, r: 0 }));
    this.db.prepare(`
      INSERT INTO totemsdk_kv (key, value, revision) VALUES (?, ?, 1)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, revision = totemsdk_kv.revision + 1
    `).run(key, bytes);
  }

  remove(key: string): boolean {
    return this.db.prepare('DELETE FROM totemsdk_kv WHERE key = ?').run(key).changes > 0;
  }

  has(key: string): boolean {
    return this.db.prepare('SELECT 1 FROM totemsdk_kv WHERE key = ?').get(key) !== undefined;
  }

  keys(): string[] {
    return (this.db.prepare('SELECT key FROM totemsdk_kv ORDER BY key').all() as Array<{ key: string }>)
      .map((row) => row.key);
  }

  clear(): void {
    this.db.exec('DELETE FROM totemsdk_kv');
  }

  /** Run a synchronous callback inside one SQLite transaction (rollback on throw). */
  transaction<T>(fn: () => T): T {
    if (this.db.inTransaction) return fn();
    return this.db.transaction(fn)();
  }

  /** Run a one-off SQL statement (one-time migration/test setup only). */
  exec(sql: string): void {
    this.db.exec(sql);
  }

  /** Whether a legacy/relational table exists (one-time migration helper). */
  tableExists(table: string): boolean {
    if (!/^[a-z0-9_]+$/i.test(table)) throw new Error(`invalid table name: ${table}`);
    return this.db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table) !== undefined;
  }

  /**
   * One-time migration of a legacy table into key-value records, then drop it.
   * The mapper runs inside a transaction; a throw leaves the table intact.
   */
  migrateLegacyTable<T>(table: string, mapper: (row: Record<string, unknown>) => { key: string; value: T }): number {
    if (!this.tableExists(table)) return 0;
    if (!/^[a-z0-9_]+$/i.test(table)) throw new Error(`invalid table name: ${table}`);
    const rows = this.db.prepare(`SELECT * FROM ${table}`).all() as Array<Record<string, unknown>>;
    return this.transaction(() => {
      for (const row of rows) {
        const mapped = mapper(row);
        this.set(mapped.key, mapped.value);
      }
      this.db.exec(`DROP TABLE ${table}`);
      return rows.length;
    });
  }

  close(): void {
    this.db.close();
  }
}
