/**
 * @module @totemsdk/storage/sqlite
 *
 * `better-sqlite3`-backed `StorageAdapter`. Write acknowledgment is
 * `durably-acknowledged` (WAL + synchronous=FULL). Multi-key transactions are
 * atomic (a single SQLite `BEGIN IMMEDIATE`/`COMMIT`). CAS is revision-based:
 * `UPDATE kv SET value=?, revision=? WHERE key=? AND revision=?`.
 *
 * Native `better-sqlite3` lives behind this isolated subpath — the neutral
 * package surface (`@totemsdk/storage`) never imports it.
 */

import Database from 'better-sqlite3';

import { codec } from '../codec.js';
import { StorageError } from '../errors.js';
import type {
  CasStore,
  ConditionalResult,
  ConditionalUpdater,
  FailurePolicy,
  StoreCapabilities,
  StorageAdapterWithCapabilities,
  Transaction,
  TransactionalStore,
} from '../types.js';

interface SqliteRow {
  value: Buffer;
  revision: number;
}

type SqliteOp =
  | { type: 'set'; key: string; value: unknown }
  | { type: 'remove'; key: string };

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS totemsdk_kv (
    key      TEXT PRIMARY KEY,
    value    BLOB NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1
  );
`;

export interface SqliteStoreOptions {
  readonly failurePolicy?: FailurePolicy;
}

export class SqliteStore implements StorageAdapterWithCapabilities, CasStore, TransactionalStore {
  readonly capabilities: StoreCapabilities = {
    acknowledge: 'durably-acknowledged',
    atomic: true,
    conditional: true,
  };

  private readonly db: Database.Database;
  private readonly failurePolicy: FailurePolicy;
  private readonly getStmt: Database.Statement;
  private readonly upsertStmt: Database.Statement;
  private readonly deleteStmt: Database.Statement;
  private readonly clearStmt: Database.Statement;
  private readonly casStmt: Database.Statement;

  constructor(path = ':memory:', options: SqliteStoreOptions = {}) {
    this.failurePolicy = options.failurePolicy ?? 'strict';
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = FULL');
    this.db.exec(SCHEMA);
    this.getStmt = this.db.prepare('SELECT value, revision FROM totemsdk_kv WHERE key = ?');
    this.upsertStmt = this.db.prepare(`
      INSERT INTO totemsdk_kv (key, value, revision) VALUES (?, ?, 1)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, revision = totemsdk_kv.revision + 1
    `);
    this.deleteStmt = this.db.prepare('DELETE FROM totemsdk_kv WHERE key = ?');
    this.clearStmt = this.db.prepare('DELETE FROM totemsdk_kv');
    this.casStmt = this.db.prepare('UPDATE totemsdk_kv SET value = ?, revision = ? WHERE key = ? AND revision = ?');
  }

  private decodeRow(row: SqliteRow | undefined, key: string): unknown {
    if (!row) return null;
    try {
      return codec.deserialize(new Uint8Array(row.value));
    } catch (err) {
      if (this.failurePolicy === 'lenient') return null;
      throw new StorageError(
        err instanceof StorageError ? err.message : 'corrupt record',
        'corrupt',
        { key, cause: err },
      );
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const row = this.getStmt.get(key) as SqliteRow | undefined;
    const envelope = this.decodeRow(row, key) as { k: string; v: T; r: number } | null;
    if (!envelope) return null;
    if (envelope.k !== key) {
      if (this.failurePolicy === 'lenient') return null;
      throw new StorageError('envelope key mismatch', 'corrupt', { key });
    }
    return envelope.v as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.upsertStmt.run(key, Buffer.from(codec.serialize({ k: key, v: value, r: 0 })));
  }

  async remove(key: string): Promise<boolean> {
    const info = this.deleteStmt.run(key);
    return info.changes > 0;
  }

  async clear(): Promise<void> {
    this.clearStmt.run();
  }

  async keys(): Promise<string[]> {
    const rows = this.db.prepare('SELECT key FROM totemsdk_kv').all() as { key: string }[];
    return rows.map((r) => r.key).sort();
  }

  async has(key: string): Promise<boolean> {
    const row = this.getStmt.get(key);
    return row !== undefined;
  }

  async conditionalUpdate<T>(key: string, update: ConditionalUpdater<T>): Promise<ConditionalResult<T>> {
    const run = (): ConditionalResult<T> => {
      const row = this.getStmt.get(key) as SqliteRow | undefined;
      const envelope = row ? (this.decodeRow(row, key) as { k: string; v: T; r: number } | null) : null;
      const current = envelope ? (envelope.v as T | null) : null;
      const revision = row ? row.revision : 0;

      const decision = update(current);
      if ('abort' in decision) {
        return { applied: false, value: current, revision };
      }

      const next = { k: key, v: decision.next, r: revision + 1 };
      const bytes = Buffer.from(codec.serialize(next));
      if (revision === 0) {
        const insertInfo = this.db
          .prepare('INSERT OR ABORT INTO totemsdk_kv (key, value, revision) VALUES (?, ?, ?)')
          .run(key, bytes, 1);
        if (insertInfo.changes === 0) {
          throw new StorageError('CAS conflict (concurrent modification)', 'write-failed', { key });
        }
      } else {
        const info = this.casStmt.run(bytes, revision + 1, key, revision);
        if (info.changes === 0) {
          throw new StorageError('CAS conflict (concurrent modification)', 'write-failed', { key });
        }
      }
      return { applied: true, value: decision.next, revision: revision + 1 };
    };

    if (this.db.inTransaction) return run();
    return this.db.transaction(run)();
  }

  transaction(): Transaction {
    return new SqliteTransaction(this.db, this.failurePolicy);
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

class SqliteTransaction implements Transaction {
  private readonly ops: SqliteOp[] = [];

  constructor(
    private readonly db: Database.Database,
    private readonly failurePolicy: FailurePolicy,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const row = this.db.prepare('SELECT value, revision FROM totemsdk_kv WHERE key = ?').get(key) as SqliteRow | undefined;
    if (!row) return null;
    try {
      const envelope = codec.deserialize(new Uint8Array(row.value)) as { v: T; k: string };
      return envelope.v as T;
    } catch {
      if (this.failurePolicy === 'lenient') return null;
      throw new StorageError('corrupt record', 'corrupt', { key });
    }
  }

  set<T>(key: string, value: T): Transaction {
    this.ops.push({ type: 'set', key, value });
    return this;
  }

  remove(key: string): Transaction {
    this.ops.push({ type: 'remove', key });
    return this;
  }

  async commit(): Promise<void> {
    const upsertStmt = this.db.prepare(`
      INSERT INTO totemsdk_kv (key, value, revision) VALUES (?, ?, 1)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, revision = totemsdk_kv.revision + 1
    `);
    const deleteStmt = this.db.prepare('DELETE FROM totemsdk_kv WHERE key = ?');

    this.db.transaction(() => {
      for (const op of this.ops) {
        if (op.type === 'set') {
          upsertStmt.run(op.key, Buffer.from(codec.serialize({ k: op.key, v: op.value, r: 0 })));
        } else {
          deleteStmt.run(op.key);
        }
      }
    })();
  }
}