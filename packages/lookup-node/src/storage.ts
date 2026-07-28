/**
 * SqliteStore — synchronous SQLite-backed persistence for the lookup-node.
 *
 * Uses better-sqlite3 for all writes/reads. Pass ':memory:' for ephemeral
 * storage (tests, lightweight nodes). Pass a file path for durable storage.
 *
 * Covers:
 *   - Relay dedup (prevents resubmitting already-seen TxPoWs)
 *   - Result cache (reduces PureMinima RPC load, with TTL)
 *   - Durable KV store (lease journal, no TTL)
 *   - Watchlist persistence (address subscriptions survive restarts)
 *   - App registry (AppManifest announcements with authorAddress/isFree columns)
 *   - Agent registry (CapabilityManifest announcements with tag/price/latency)
 *   - Trust index (WOTS-signed reviews per subjectId/reviewerAddress)
 *
 * SqliteStorageAdapter wraps SqliteStore to implement @totemsdk/core's
 * StorageAdapter interface, used by LocalLeaseProvider for durable lease
 * journal storage backed by the same SQLite file as the rest of the node.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * ESM/CJS compatibility note:
 *
 * `better-sqlite3` is a CJS module with a native addon. In Node.js ESM (production)
 * it is imported via a static `import` — Node.js transparently wraps the CJS
 * module.exports into an ESM default export.
 *
 * In ts-jest (CommonJS transform), TypeScript compiles
 *   import Database from 'better-sqlite3'
 * to:
 *   const better_sqlite3_1 = __importDefault(require('better-sqlite3'))
 * which works identically.
 *
 * This avoids `import.meta.url` (not available in ts-jest CJS mode) entirely.
 */
import Database from 'better-sqlite3';
import type { StorageAdapter } from '@totemsdk/core';

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface TrustRow {
  subjectId: string;
  reviewerAddress: string;
  rating: number;
  comment?: string;
  signature: string;
  recordedAt: number;
}

export interface AppRow {
  appId: string;
  manifest: Buffer;
  nodeId: string;
  expiresAt: number;
  publicKey?: string;
  signature?: string;
  authorAddress?: string;
  /** SQLite boolean: 1 = free, 0 = paid, null = unknown */
  isFree?: number;
}

export interface AgentRow {
  capabilityId: string;
  manifest: Buffer;
  nodeId: string;
  expiresAt: number;
  publicKey?: string;
  signature?: string;
  tags?: string;        // JSON-serialized string[]
  pricePerCall?: number;
  latencyMs?: number;
}

// ---------------------------------------------------------------------------
// SqliteStore
// ---------------------------------------------------------------------------

export class SqliteStore {
  private readonly _db: Database.Database;

  constructor(dbPath: string) {
    this._db = new Database(dbPath);
    this._init();
  }

  private _init(): void {
    this._db.exec(`
      PRAGMA journal_mode = WAL;

      -- Relay duplicate detection
      CREATE TABLE IF NOT EXISTS relay_dedup (
        tx_key   TEXT    PRIMARY KEY,
        seen_at  INTEGER NOT NULL
      );

      -- Short-lived result cache (has TTL)
      CREATE TABLE IF NOT EXISTS result_cache (
        cache_key  TEXT    PRIMARY KEY,
        data       TEXT    NOT NULL,
        expires_at INTEGER NOT NULL
      );

      -- Durable key-value store (no TTL — used for lease journal)
      CREATE TABLE IF NOT EXISTS kv_store (
        kv_key   TEXT    PRIMARY KEY,
        kv_value TEXT    NOT NULL
      );

      -- Watchlist address subscriptions (persists across restarts)
      CREATE TABLE IF NOT EXISTS watchlist (
        session_id TEXT    NOT NULL,
        address    TEXT    NOT NULL,
        PRIMARY KEY (session_id, address)
      );

      CREATE TABLE IF NOT EXISTS app_registry (
        appId         TEXT    PRIMARY KEY,
        manifest      BLOB    NOT NULL,
        nodeId        TEXT    NOT NULL,
        expiresAt     INTEGER NOT NULL,
        publicKey     TEXT,
        signature     TEXT,
        authorAddress TEXT,
        isFree        INTEGER
      );

      CREATE TABLE IF NOT EXISTS agent_registry (
        capabilityId TEXT    PRIMARY KEY,
        manifest     BLOB    NOT NULL,
        nodeId       TEXT    NOT NULL,
        expiresAt    INTEGER NOT NULL,
        publicKey    TEXT,
        signature    TEXT,
        tags         TEXT,
        pricePerCall REAL,
        latencyMs    REAL
      );

      CREATE TABLE IF NOT EXISTS trust_index (
        subjectId       TEXT    NOT NULL,
        reviewerAddress TEXT    NOT NULL,
        rating          INTEGER NOT NULL,
        comment         TEXT,
        signature       TEXT    NOT NULL,
        recordedAt      INTEGER NOT NULL,
        PRIMARY KEY (subjectId, reviewerAddress)
      );
    `);
  }

  // ---------------------------------------------------------------------------
  // Relay dedup
  // ---------------------------------------------------------------------------

  relayHasSeen(key: string): boolean {
    return this._db.prepare('SELECT 1 FROM relay_dedup WHERE tx_key = ?').get(key) !== undefined;
  }

  relayMarkSeen(key: string): void {
    this._db.prepare(
      'INSERT OR IGNORE INTO relay_dedup (tx_key, seen_at) VALUES (?, ?)',
    ).run(key, Date.now());
  }

  /** Keep only the newest `maxCount` entries (evict oldest). */
  relayEvictOldest(maxCount: number): void {
    this._db.prepare(`
      DELETE FROM relay_dedup
      WHERE tx_key IN (
        SELECT tx_key FROM relay_dedup
        ORDER BY seen_at ASC
        LIMIT MAX(0, (SELECT COUNT(*) FROM relay_dedup) - ?)
      )
    `).run(maxCount);
  }

  // ---------------------------------------------------------------------------
  // Result cache (with TTL)
  // ---------------------------------------------------------------------------

  cacheGet(key: string): string | null {
    const row = this._db.prepare(
      'SELECT data FROM result_cache WHERE cache_key = ? AND expires_at > ?',
    ).get(key, Date.now()) as { data: string } | undefined;
    return row?.data ?? null;
  }

  cacheSet(key: string, data: string, ttlMs: number): void {
    this._db.prepare(
      'INSERT OR REPLACE INTO result_cache (cache_key, data, expires_at) VALUES (?, ?, ?)',
    ).run(key, data, Date.now() + ttlMs);
  }

  cacheEvictExpired(): void {
    this._db.prepare('DELETE FROM result_cache WHERE expires_at <= ?').run(Date.now());
  }

  // ---------------------------------------------------------------------------
  // Durable KV store (no TTL — for lease journal)
  // ---------------------------------------------------------------------------

  kvGet(key: string): string | null {
    const row = this._db.prepare('SELECT kv_value FROM kv_store WHERE kv_key = ?').get(key) as
      | { kv_value: string }
      | undefined;
    return row?.kv_value ?? null;
  }

  kvSet(key: string, value: string): void {
    this._db.prepare(
      'INSERT OR REPLACE INTO kv_store (kv_key, kv_value) VALUES (?, ?)',
    ).run(key, value);
  }

  kvRemove(key: string): boolean {
    const result = this._db.prepare('DELETE FROM kv_store WHERE kv_key = ?').run(key);
    return result.changes > 0;
  }

  kvHas(key: string): boolean {
    return this._db.prepare('SELECT 1 FROM kv_store WHERE kv_key = ?').get(key) !== undefined;
  }

  kvKeys(prefix?: string): string[] {
    if (prefix) {
      return (
        this._db.prepare("SELECT kv_key FROM kv_store WHERE kv_key LIKE ? ESCAPE '\\'").all(
          prefix.replace(/[%_\\]/g, (c) => '\\' + c) + '%',
        ) as { kv_key: string }[]
      ).map((r) => r.kv_key);
    }
    return (this._db.prepare('SELECT kv_key FROM kv_store').all() as { kv_key: string }[]).map(
      (r) => r.kv_key,
    );
  }

  kvClear(): void {
    this._db.prepare('DELETE FROM kv_store').run();
  }

  // ---------------------------------------------------------------------------
  // Watchlist persistence
  // ---------------------------------------------------------------------------

  watchlistAdd(sessionId: string, addresses: string[]): void {
    const stmt = this._db.prepare(
      'INSERT OR IGNORE INTO watchlist (session_id, address) VALUES (?, ?)',
    );
    for (const addr of addresses) {
      stmt.run(sessionId, addr);
    }
  }

  watchlistRemove(sessionId: string, addresses: string[]): void {
    const stmt = this._db.prepare(
      'DELETE FROM watchlist WHERE session_id = ? AND address = ?',
    );
    for (const addr of addresses) {
      stmt.run(sessionId, addr);
    }
  }

  watchlistRemoveSession(sessionId: string): void {
    this._db.prepare('DELETE FROM watchlist WHERE session_id = ?').run(sessionId);
  }

  /** All unique addresses currently being watched (for recovery polling after restart). */
  watchlistGetAllAddresses(): string[] {
    return (
      this._db.prepare('SELECT DISTINCT address FROM watchlist').all() as { address: string }[]
    ).map((r) => r.address);
  }

  /** All (sessionId, address) pairs (to rebuild in-memory map on restart). */
  watchlistGetAll(): { sessionId: string; address: string }[] {
    return (
      this._db.prepare('SELECT session_id AS sessionId, address FROM watchlist').all() as {
        sessionId: string;
        address: string;
      }[]
    );
  }

  // ---------------------------------------------------------------------------
  // App registry
  // ---------------------------------------------------------------------------

  appUpsert(row: AppRow): void {
    this._db.prepare(`
      INSERT OR REPLACE INTO app_registry
        (appId, manifest, nodeId, expiresAt, publicKey, signature, authorAddress, isFree)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      row.appId,
      Buffer.from(row.manifest),
      row.nodeId,
      row.expiresAt,
      row.publicKey ?? null,
      row.signature ?? null,
      row.authorAddress ?? null,
      row.isFree ?? null,
    );
  }

  appQuery(now: number, authorAddress?: string, isFree?: boolean): AppRow[] {
    let sql = 'SELECT * FROM app_registry WHERE expiresAt > ?';
    const params: unknown[] = [now];

    if (authorAddress) {
      sql += ' AND authorAddress = ?';
      params.push(authorAddress);
    }
    if (isFree !== undefined) {
      sql += ' AND isFree = ?';
      params.push(isFree ? 1 : 0);
    }

    return this._db.prepare(sql).all(...params) as AppRow[];
  }

  appDeleteExpired(now: number): void {
    this._db.prepare('DELETE FROM app_registry WHERE expiresAt <= ?').run(now);
  }

  // ---------------------------------------------------------------------------
  // Agent registry
  // ---------------------------------------------------------------------------

  agentUpsert(row: AgentRow): void {
    this._db.prepare(`
      INSERT OR REPLACE INTO agent_registry
        (capabilityId, manifest, nodeId, expiresAt, publicKey, signature, tags, pricePerCall, latencyMs)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      row.capabilityId,
      Buffer.from(row.manifest),
      row.nodeId,
      row.expiresAt,
      row.publicKey ?? null,
      row.signature ?? null,
      row.tags ?? null,
      row.pricePerCall ?? null,
      row.latencyMs ?? null,
    );
  }

  agentQuery(now: number): AgentRow[] {
    return this._db.prepare(
      'SELECT * FROM agent_registry WHERE expiresAt > ?',
    ).all(now) as AgentRow[];
  }

  agentDeleteExpired(now: number): void {
    this._db.prepare('DELETE FROM agent_registry WHERE expiresAt <= ?').run(now);
  }

  // ---------------------------------------------------------------------------
  // Trust index
  // ---------------------------------------------------------------------------

  trustUpsert(row: TrustRow): void {
    this._db.prepare(`
      INSERT OR REPLACE INTO trust_index
        (subjectId, reviewerAddress, rating, comment, signature, recordedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      row.subjectId,
      row.reviewerAddress,
      row.rating,
      row.comment ?? null,
      row.signature,
      row.recordedAt,
    );
  }

  trustQuery(subjectId: string): TrustRow[] {
    return this._db.prepare(
      'SELECT * FROM trust_index WHERE subjectId = ?',
    ).all(subjectId) as TrustRow[];
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  close(): void {
    this._db.close();
  }
}

// ---------------------------------------------------------------------------
// SqliteStorageAdapter — bridges SqliteStore to @totemsdk/core's StorageAdapter
// ---------------------------------------------------------------------------

/**
 * Wraps SqliteStore's durable KV store to implement the `StorageAdapter`
 * interface expected by `LocalLeaseProvider` and other @totemsdk/core consumers.
 *
 * All methods are async for interface compliance but execute synchronously
 * against the SQLite backend (better-sqlite3 is synchronous).
 */
export class SqliteStorageAdapter implements StorageAdapter {
  constructor(private readonly _store: SqliteStore) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = this._store.kvGet(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    this._store.kvSet(key, JSON.stringify(value));
  }

  async remove(key: string): Promise<boolean> {
    return this._store.kvRemove(key);
  }

  async clear(): Promise<void> {
    this._store.kvClear();
  }

  async keys(): Promise<string[]> {
    return this._store.kvKeys();
  }

  async has(key: string): Promise<boolean> {
    return this._store.kvHas(key);
  }
}
