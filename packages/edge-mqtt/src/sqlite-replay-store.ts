/**
 * Node SQLite replay claims. Native storage is isolated behind this subpath;
 * importing the MQTT root does not import SQLite or filesystem bindings.
 */
import { isAbsolute } from 'node:path';
import { SqliteStore } from '@totemsdk/storage/sqlite';
import type { ReplayLedgerStore } from './types.js';

export interface SqliteMqttReplayStoreOptions {
  /** Absolute local database filename. In-memory/URI databases are rejected. */
  path: string;
  /** Collision-control scope, not authorization. Default 'mqtt-replay-v1'. */
  namespace?: string;
  /** SQLite lock wait in ms. Default 5000; exhaustion throws and blocks execution. */
  busyTimeoutMs?: number;
}

export interface SqliteMqttReplayStore extends ReplayLedgerStore {
  /** The composition root owns shutdown, after in-flight handlers have settled. */
  close(): Promise<void>;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS totem_mqtt_replay_claims_v1 (
    namespace TEXT NOT NULL,
    key TEXT NOT NULL,
    claimed_at INTEGER NOT NULL CHECK (typeof(claimed_at) = 'integer' AND claimed_at >= 0),
    expires_at INTEGER NOT NULL CHECK (typeof(expires_at) = 'integer' AND expires_at >= claimed_at),
    PRIMARY KEY (namespace, key)
  );
`;

/**
 * Open file-backed WAL/FULL SQLite replay protection using the shared storage
 * adapter. One conditional UPSERT commits before a claim resolves true. Rows
 * are not automatically deleted: replay retention is independent of queue or
 * execution-log retention. Claims describe admission, never completed effects.
 */
export async function createSqliteMqttReplayStore(options: SqliteMqttReplayStoreOptions): Promise<SqliteMqttReplayStore> {
  if (typeof options.path !== 'string' || !isAbsolute(options.path) || options.path.includes('\0')) {
    throw new Error('MQTT replay storage requires an absolute file-backed database path');
  }
  const namespace = options.namespace ?? 'mqtt-replay-v1';
  if (typeof namespace !== 'string' || !namespace.trim()) throw new Error('MQTT replay namespace must be nonempty');
  const busyTimeoutMs = options.busyTimeoutMs ?? 5000;
  if (!Number.isSafeInteger(busyTimeoutMs) || busyTimeoutMs < 0 || busyTimeoutMs > 60_000) {
    throw new Error('MQTT replay busyTimeoutMs must be an integer from 0 to 60000');
  }
  const storage = new SqliteStore(options.path, {
    createKvTable: false, wal: true, failurePolicy: 'strict', busyTimeoutMs,
  });
  try {
    storage.transactionalSync((tx) => tx.exec(SCHEMA));
  } catch (error) {
    await storage.close();
    throw error;
  }
  let closed = false;
  return {
    async claim(key, expiresAt, now) {
      if (closed) throw new Error('MQTT replay store is closed');
      if (typeof key !== 'string' || !key) throw new Error('MQTT replay claim key must be nonempty');
      if (!Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(expiresAt) || expiresAt < now) {
        throw new Error('MQTT replay claim timestamps must be safe integers with expiresAt >= now >= 0');
      }
      const changed = storage.transactionalSync((tx) => tx.run(`
        INSERT INTO totem_mqtt_replay_claims_v1 (namespace, key, claimed_at, expires_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(namespace, key) DO UPDATE SET
          claimed_at = excluded.claimed_at, expires_at = excluded.expires_at
        WHERE totem_mqtt_replay_claims_v1.expires_at < excluded.claimed_at
      `, namespace, key, now, expiresAt));
      return changed === 1;
    },
    async close() {
      if (closed) return;
      closed = true;
      await storage.close();
    },
  };
}
