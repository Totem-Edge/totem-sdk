import { createJournal, type Journal } from "@totemsdk/storage/journal";
import { MemoryStore } from "@totemsdk/storage/memory";
import { SqliteStore } from "@totemsdk/storage/sqlite";
import type { ObservationRecord, ObservationStore, OmniaObservation } from "./types.js";

const DEFAULT_NAMESPACE = "omnia:observe:v1:";

function materialize(seq: number, record: ObservationRecord): OmniaObservation {
  return { ...record, sourceSequence: seq };
}

function makeStore(journal: Journal<ObservationRecord>, closeAdapter: () => Promise<void>): ObservationStore {
  return {
    async append(record) {
      const entry = await journal.append(record);
      return { seq: entry.seq, createdAt: entry.createdAt };
    },
    async readSince(seq) {
      const entries = await journal.readSince(Math.max(0, Math.floor(seq)));
      return entries.map((e) => materialize(e.seq, e.record));
    },
    async tail(count) {
      const entries = await journal.tail(Math.max(0, Math.floor(count)));
      return entries.map((e) => materialize(e.seq, e.record));
    },
    head: () => journal.getHead(),
    count: () => journal.count(),
    close: closeAdapter,
  };
}

export interface SqliteObservationStoreOptions {
  namespace?: string;
  /** WAL is on by default in SqliteStore; exposed for completeness. */
  wal?: boolean;
}

/**
 * Durable observation journal backed by `@totemsdk/storage` (RFC-007).
 *
 * Deliberately **not** a direct `better-sqlite3`/DuckDB write: omnia-host
 * persists through the storage SDK so the same adapter can be swapped
 * (file/idb/memory) and the journal gets CAS head sequencing, crash-recovery and
 * forward-migratable records for free.
 */
export async function createSqliteObservationStore(
  dbPath: string,
  options: SqliteObservationStoreOptions = {},
): Promise<ObservationStore> {
  const adapter = new SqliteStore(dbPath, { wal: options.wal ?? true });
  const journal = createJournal<ObservationRecord>(adapter, {
    namespace: options.namespace ?? DEFAULT_NAMESPACE,
    requireAckMode: "durably-acknowledged",
  });
  await journal.recover();
  return makeStore(journal, async () => {
    await (adapter as unknown as { close?: () => Promise<void> }).close?.();
  });
}

/** In-memory journal for tests/embedding (volatile acknowledgment). */
export async function createMemoryObservationStore(
  options: { namespace?: string } = {},
): Promise<ObservationStore> {
  const adapter = new MemoryStore();
  const journal = createJournal<ObservationRecord>(adapter, {
    namespace: options.namespace ?? DEFAULT_NAMESPACE,
    requireAckMode: "volatile",
  });
  await journal.recover();
  return makeStore(journal, async () => {
    await (adapter as unknown as { close?: () => Promise<void> }).close?.();
  });
}

/** No-op store for read-only/embedded deployments that opt out of observation. */
export class DisabledObservationStore implements ObservationStore {
  async append(): Promise<{ seq: number; createdAt: number }> {
    return { seq: 0, createdAt: Date.now() };
  }
  async readSince(): Promise<OmniaObservation[]> {
    return [];
  }
  async tail(): Promise<OmniaObservation[]> {
    return [];
  }
  async head(): Promise<number> {
    return 0;
  }
  async count(): Promise<number> {
    return 0;
  }
  async close(): Promise<void> {}
}
