/**
 * @module @totemsdk/storage/sqlite
 *
 * `better-sqlite3`-backed `StorageAdapter`. Write acknowledgment is
 * `durably-acknowledged` (WAL + synchronous=FULL). Multi-key transactions are
 * atomic (a single SQLite `BEGIN IMMEDIATE`/`COMMIT`). CAS is revision-based:
 * `UPDATE kv SET value=?, revision=? WHERE key=? AND revision=?`.
 *
 * Besides the key-value surface, `SqliteStore` exposes the shared relational
 * primitives that consumer stores consolidate onto: `transactionalSync()`
 * (atomic multi-statement batches with automatic rollback on throw, RFC-007
 * §4.2 `Transaction`+CAS) and `transitionAndEnqueue()` (revision-CAS update +
 * outbox-style enqueue committed atomically — the generalized
 * `transitionAndEnqueue` of RFC-007 §4.2). Consumer stores keep their own
 * schemas ("records unchanged in shape") and run their statements on one
 * connection through these primitives.
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

interface SqliteKvStatements {
  get: Database.Statement;
  upsert: Database.Statement;
  deleteStmt: Database.Statement;
  clear: Database.Statement;
  cas: Database.Statement;
  insertAbort: Database.Statement;
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
  /** WAL journal mode when opened (default true). */
  readonly wal?: boolean;
  /** `busy_timeout` in ms for concurrent runtime access (default 5000). */
  readonly busyTimeoutMs?: number;
  /** Enable `PRAGMA foreign_keys = ON` (default false). */
  readonly foreignKeys?: boolean;
  /** Create the internal `totemsdk_kv` table (default true). */
  readonly createKvTable?: boolean;
}

/** Bindable SQLite parameter. */
export type SqliteBind = string | number | bigint | null | Buffer | Uint8Array;

/**
 * Synchronous transactional handle passed to `transactionalSync()` callbacks.
 * All statements share one SQLite transaction; throwing inside the callback
 * rolls the whole batch back.
 */
export interface SqliteTx {
  readonly inTransaction: boolean;
  /** Run a statement and return the number of rows touched. */
  run(sql: string, ...params: SqliteBind[]): number;
  get<T>(sql: string, ...params: SqliteBind[]): T | undefined;
  all<T>(sql: string, ...params: SqliteBind[]): T[];
  /** Run a statement that must touch exactly one row; throws `write-failed` otherwise. */
  cas(sql: string, ...params: SqliteBind[]): void;
  exec(sql: string): void;
}

export interface TransitionAndEnqueueOptions {
  /** Revision-guarded UPDATE that must affect exactly one row to win. */
  readonly casUpdateSql: string;
  readonly casUpdateParams: SqliteBind[];
  /** `INSERT OR REPLACE`-style outbox enqueue statement. */
  readonly enqueueSql: string;
  /** One row of parameters per outbox message, committed with the CAS. */
  readonly enqueueRows: SqliteBind[][];
}

export class SqliteStore implements StorageAdapterWithCapabilities, CasStore, TransactionalStore {
  readonly capabilities: StoreCapabilities = {
    acknowledge: 'durably-acknowledged',
    atomic: true,
    conditional: true,
  };

  private readonly db: Database.Database;
  private readonly failurePolicy: FailurePolicy;
  private readonly txHandle: SqliteTx;
  private readonly createKvTable: boolean;
  private kvStmts: SqliteKvStatements | null = null;

  constructor(path = ':memory:', options: SqliteStoreOptions = {}) {
    this.createKvTable = options.createKvTable !== false;
    this.failurePolicy = options.failurePolicy ?? 'strict';
    this.db = new Database(path);
    this.db.pragma(`journal_mode = ${options.wal === false ? 'DELETE' : 'WAL'}`);
    this.db.pragma('synchronous = FULL');
    if (options.busyTimeoutMs !== undefined) this.db.pragma(`busy_timeout = ${options.busyTimeoutMs}`);
    if (options.foreignKeys === true) this.db.pragma('foreign_keys = ON');
    if (this.createKvTable) this.db.exec(SCHEMA);
    this.txHandle = new RelationalTx(this.db);
  }

  /** Lazily-prepared key-value statements (the `totemsdk_kv` table may not exist). */
  private kv(): SqliteKvStatements {
    if (this.kvStmts) return this.kvStmts;
    if (!this.createKvTable) {
      throw new StorageError('SqliteStore opened without a key-value table (createKvTable: false)', 'unavailable');
    }
    this.kvStmts = {
      get: this.db.prepare('SELECT value, revision FROM totemsdk_kv WHERE key = ?'),
      upsert: this.db.prepare(`
        INSERT INTO totemsdk_kv (key, value, revision) VALUES (?, ?, 1)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, revision = totemsdk_kv.revision + 1
      `),
      deleteStmt: this.db.prepare('DELETE FROM totemsdk_kv WHERE key = ?'),
      clear: this.db.prepare('DELETE FROM totemsdk_kv'),
      cas: this.db.prepare('UPDATE totemsdk_kv SET value = ?, revision = ? WHERE key = ? AND revision = ?'),
      insertAbort: this.db.prepare('INSERT OR ABORT INTO totemsdk_kv (key, value, revision) VALUES (?, ?, ?)'),
    };
    return this.kvStmts;
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
    const s = this.kv();
    const row = s.get.get(key) as SqliteRow | undefined;
    const envelope = this.decodeRow(row, key) as { k: string; v: T; r: number } | null;
    if (!envelope) return null;
    if (envelope.k !== key) {
      if (this.failurePolicy === 'lenient') return null;
      throw new StorageError('envelope key mismatch', 'corrupt', { key });
    }
    return envelope.v as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.kv().upsert.run(key, Buffer.from(codec.serialize({ k: key, v: value, r: 0 })));
  }

  async remove(key: string): Promise<boolean> {
    const info = this.kv().deleteStmt.run(key);
    return info.changes > 0;
  }

  async clear(): Promise<void> {
    this.kv().clear.run();
  }

  async keys(): Promise<string[]> {
    this.kv(); // ensure the key-value store is present
    const rows = this.db.prepare('SELECT key FROM totemsdk_kv').all() as { key: string }[];
    return rows.map((r) => r.key).sort();
  }

  async has(key: string): Promise<boolean> {
    const row = this.kv().get.get(key);
    return row !== undefined;
  }

  async conditionalUpdate<T>(key: string, update: ConditionalUpdater<T>): Promise<ConditionalResult<T>> {
    const run = (): ConditionalResult<T> => {
      const s = this.kv();
      const row = s.get.get(key) as SqliteRow | undefined;
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
        const insertInfo = s.insertAbort.run(key, bytes, 1);
        if (insertInfo.changes === 0) {
          throw new StorageError('CAS conflict (concurrent modification)', 'write-failed', { key });
        }
      } else {
        const info = s.cas.run(bytes, revision + 1, key, revision);
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

  /**
   * Run a batch of statements in one atomic transaction. Statements reach the
   * database through `tx`; throwing inside `fn` rolls the whole batch back.
   * Consumer stores (e.g. commerce, run-state) consolidate their multi-statement
   * mutations onto this primitive (RFC-007 §4.2 `Transaction` + CAS).
   */
  transactionalSync<T>(fn: (tx: SqliteTx) => T): T {
    return this.db.transaction(() => fn(this.txHandle))();
  }

  /**
   * Generalized `transitionAndEnqueue` (RFC-007 §4.2): a revision-guarded CAS
   * update and outbox-style enqueue committed atomically. If the CAS touches
   * zero rows the whole batch rolls back (nothing is enqueued) and `false` is
   * returned; `true` means both the update and every enqueued row committed.
   */
  async transitionAndEnqueue(params: TransitionAndEnqueueOptions): Promise<boolean> {
    try {
      this.db.transaction(() => {
        const cas = this.db.prepare(params.casUpdateSql);
        if (cas.run(...params.casUpdateParams).changes !== 1) {
          throw new StorageError('transitionAndEnqueue: CAS conflict (concurrent modification)', 'write-failed');
        }
        if (params.enqueueRows.length > 0) {
          const enqueue = this.db.prepare(params.enqueueSql);
          for (const row of params.enqueueRows) enqueue.run(...row);
        }
      })();
      return true;
    } catch (err) {
      if (err instanceof StorageError && err.code === 'write-failed') return false;
      throw err;
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

/**
 * Handles statements over one `better-sqlite3` connection inside the
 * `transactionalSync()` transaction scope.
 */
class RelationalTx implements SqliteTx {
  constructor(private readonly db: Database.Database) {}

  get inTransaction(): boolean {
    return this.db.inTransaction;
  }

  run(sql: string, ...params: SqliteBind[]): number {
    return this.db.prepare(sql).run(...params).changes;
  }

  get<T>(sql: string, ...params: SqliteBind[]): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }

  all<T>(sql: string, ...params: SqliteBind[]): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  cas(sql: string, ...params: SqliteBind[]): void {
    if (this.db.prepare(sql).run(...params).changes === 0) {
      throw new StorageError('CAS update touched no rows', 'write-failed');
    }
  }

  exec(sql: string): void {
    this.db.exec(sql);
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