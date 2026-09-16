/**
 * sqlite-commerce-store.ts — Production SQLite-backed CommerceStore.
 *
 * Implements the five durable commerce contracts over ONE SQLite database:
 *   NegotiationStore, PurchaseStore, ReplayLedger, PrincipalNegotiationStore,
 *   OutboxStore.
 *
 * The database connection, journal/busy pragmas, transaction lifecycle, and
 * CAS kinematics are owned by the shared `SqliteStore` primitive from
 * `@totemsdk/storage/sqlite` (RFC-007 §4.2). All consumer mutations run through
 * `transactionalSync` (atomic multi-statement batches) or the generalized
 * `transitionAndEnqueue` (revision-CAS update + outbox-style enqueue in one
 * commit). Table schemas and row shapes are unchanged ("records unchanged in
 * shape").
 *
 * The critical guarantee — `transitionAndEnqueue` (negotiation CAS + outbox
 * enqueue) — maps to ONE transaction on the shared primitive:
 *
 *   BEGIN
 *   UPDATE negotiations SET ... WHERE negotiation_id=? AND revision=?
 *   INSERT INTO outbox (...) VALUES (...)
 *   COMMIT   (or ROLLBACK on CAS miss — nothing is enqueued)
 *
 * Uses WAL mode + busy_timeout for concurrent runtime use. Does NOT persist
 * private keys — only stable references/IDs.
 *
 * All statements use positional `?` parameters so the same SQL runs on the
 * real better-sqlite3 native binding and the node:sqlite jest mock.
 */

import { SqliteStore } from '@totemsdk/storage/sqlite';
import type {
  NegotiationStore,
  OutboxMessage,
  PrincipalNegotiationStore,
  PurchaseStore,
} from '@totemsdk/edge';
import type {
  ReplayEntry,
  ReplayLedger,
  ReplayOutcome,
} from '@totemsdk/edge';
import type { OutboxEntry, OutboxStore } from '@totemsdk/edge';
import type { NegotiationRecord } from '@totemsdk/edge';
import type { PurchaseRecord } from '@totemsdk/edge';

/** Aggregated durable commerce store. */
export interface CommerceStore {
  negotiations: NegotiationStore;
  purchases: PurchaseStore;
  replay: ReplayLedger;
  principals: PrincipalNegotiationStore;
  outbox: OutboxStore;
}

export interface SQLiteCommerceStoreConfig {
  /** File path, or ':memory:' for ephemeral. */
  filename: string;
  /** WAL mode (default true). */
  wal?: boolean;
  /** Busy timeout ms (default 5000). */
  busyTimeoutMs?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Row types
// ─────────────────────────────────────────────────────────────────────────────

interface NegotiationRow {
  negotiation_id: string;
  record_json: string;
  revision: number;
  state: string;
  principal: string;
  updated_at: number;
}

interface PurchaseRow {
  purchase_id: string;
  record_json: string;
  revision: number;
  status: string;
  updated_at: number;
}

interface ReplayRow {
  message_id: string;
  state: string;
  claimed_at: number;
  lease_until: number | null;
  outcome_json: string | null;
  completed_at: number | null;
}

interface PrincipalSlotRow {
  principal: string;
  negotiation_id: string;
  opened_at: number;
}

interface OutboxRow {
  message_id: string;
  recipient: string;
  payload: string;
  enqueued_at: number;
  delivered_at: number | null;
  attempts: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Serialization helpers
// ─────────────────────────────────────────────────────────────────────────────

function toJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v));
}

function fromJson<T>(json: string): T {
  return JSON.parse(json) as T;
}

/** Reconstruct a NegotiationRecord, restoring bigint fields. */
function rowToNegotiation(row: NegotiationRow): NegotiationRecord {
  const record = fromJson<Record<string, unknown>>(row.record_json);
  return {
    ...(record as unknown as Omit<NegotiationRecord, 'cumulativeWork'>),
    cumulativeWork: BigInt(String(record.cumulativeWork ?? '0')),
  };
}

function negotiationToRow(record: NegotiationRecord): NegotiationRow {
  return {
    negotiation_id: record.negotiationId,
    record_json: toJson(record),
    revision: record.revision,
    state: record.state,
    principal: record.principal,
    updated_at: record.updatedAt,
  };
}

function rowToPurchase(row: PurchaseRow): PurchaseRecord {
  return fromJson<PurchaseRecord>(row.record_json);
}

function purchaseToRow(record: PurchaseRecord): PurchaseRow {
  return {
    purchase_id: record.purchaseId,
    record_json: toJson(record),
    revision: record.revision,
    status: record.status,
    updated_at: record.updatedAt,
  };
}

function rowToReplay(row: ReplayRow): ReplayEntry {
  if (row.state === 'COMPLETED') {
    return {
      state: 'COMPLETED',
      outcome: fromJson<ReplayOutcome>(row.outcome_json ?? '{}'),
      completedAt: row.completed_at ?? 0,
    };
  }
  return {
    state: 'PROCESSING',
    claimedAt: row.claimed_at,
    ...(row.lease_until !== null ? { leaseUntil: row.lease_until } : {}),
  };
}

function rowToOutbox(row: OutboxRow): OutboxEntry {
  return {
    messageId: row.message_id,
    recipient: row.recipient,
    message: fromJson(row.payload),
    enqueuedAt: row.enqueued_at,
    ...(row.delivered_at !== null ? { deliveredAt: row.delivered_at } : {}),
    attempts: row.attempts,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema (unchanged — "records unchanged in shape")
// ─────────────────────────────────────────────────────────────────────────────

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS negotiations (
    negotiation_id TEXT PRIMARY KEY,
    record_json TEXT NOT NULL,
    revision INTEGER NOT NULL,
    state TEXT NOT NULL,
    principal TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_negotiations_principal ON negotiations(principal);
  CREATE INDEX IF NOT EXISTS idx_negotiations_state ON negotiations(state);

  CREATE TABLE IF NOT EXISTS purchases (
    purchase_id TEXT PRIMARY KEY,
    record_json TEXT NOT NULL,
    revision INTEGER NOT NULL,
    status TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);

  CREATE TABLE IF NOT EXISTS replay (
    message_id TEXT PRIMARY KEY,
    state TEXT NOT NULL,
    claimed_at INTEGER NOT NULL,
    lease_until INTEGER,
    outcome_json TEXT,
    completed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS principal_slots (
    principal TEXT NOT NULL,
    negotiation_id TEXT NOT NULL,
    opened_at INTEGER NOT NULL,
    PRIMARY KEY (principal, negotiation_id)
  );
  CREATE INDEX IF NOT EXISTS idx_principal_slots_principal ON principal_slots(principal);

  CREATE TABLE IF NOT EXISTS principal_cooldown (
    principal TEXT PRIMARY KEY,
    cooldown_until INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS outbox (
    message_id TEXT PRIMARY KEY,
    recipient TEXT NOT NULL,
    payload TEXT NOT NULL,
    enqueued_at INTEGER NOT NULL,
    delivered_at INTEGER,
    attempts INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_outbox_undelivered ON outbox(delivered_at);
`;

// ─────────────────────────────────────────────────────────────────────────────
// SQLite CommerceStore
// ─────────────────────────────────────────────────────────────────────────────

export class SQLiteCommerceStore implements CommerceStore {
  readonly negotiations: NegotiationStore;
  readonly purchases: PurchaseStore;
  readonly replay: ReplayLedger;
  readonly principals: PrincipalNegotiationStore;
  readonly outbox: OutboxStore;

  private readonly store: SqliteStore;

  constructor(config: SQLiteCommerceStoreConfig) {
    this.store = new SqliteStore(config.filename, {
      createKvTable: false,
      wal: config.wal,
      busyTimeoutMs: config.busyTimeoutMs ?? 5000,
    });
    this.store.transactionalSync((tx) => tx.exec(SCHEMA));

    this.negotiations = this.createNegotiationStore();
    this.purchases = this.createPurchaseStore();
    this.replay = this.createReplayLedger();
    this.principals = this.createPrincipalStore();
    this.outbox = this.createOutboxStore();
  }

  close(): void {
    void this.store.close();
  }

  // ── NegotiationStore ──────────────────────────────────────────────────────

  private createNegotiationStore(): NegotiationStore {
    const store = this.store;
    const INSERT_SQL = `
      INSERT INTO negotiations (negotiation_id, record_json, revision, state, principal, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
    `;
    const GET_SQL = `SELECT * FROM negotiations WHERE negotiation_id = ?`;
    const CAS_SQL = `
      UPDATE negotiations
       SET record_json = ?, revision = ?, state = ?, updated_at = ?
       WHERE negotiation_id = ? AND revision = ?
    `;
    const LIST_RECOVERABLE_SQL = `
      SELECT * FROM negotiations WHERE state NOT IN ('AGREED','REJECTED','CANCELLED','EXHAUSTED','EXPIRED')
    `;

    return {
      async create(record) {
        const row = negotiationToRow(record);
        store.transactionalSync((tx) => {
          tx.run(
            INSERT_SQL,
            row.negotiation_id, row.record_json, row.revision, row.state, row.principal, row.updated_at,
          );
        });
      },
      async get(negotiationId) {
        const row = store.transactionalSync((tx) => tx.get<NegotiationRow>(GET_SQL, negotiationId));
        return row ? rowToNegotiation(row) : undefined;
      },
      async compareAndSet(negotiationId, expectedRevision, next) {
        const row = negotiationToRow(next);
        const touched = store.transactionalSync((tx) =>
          tx.run(
            CAS_SQL,
            row.record_json, row.revision, row.state, row.updated_at,
            negotiationId, expectedRevision,
          ),
        );
        return touched === 1;
      },
      async transitionAndEnqueue(negotiationId, expectedRevision, next, outboxMessages) {
        // Generalized transitionAndEnqueue: CAS the negotiation and enqueue
        // every outbox message in ONE transaction (rollback on CAS miss).
        const row = negotiationToRow(next);
        const now = Date.now();
        return store.transitionAndEnqueue({
          casUpdateSql: CAS_SQL,
          casUpdateParams: [
            row.record_json, row.revision, row.state, row.updated_at,
            negotiationId, expectedRevision,
          ],
          enqueueSql: `
            INSERT OR REPLACE INTO outbox (message_id, recipient, payload, enqueued_at, attempts)
             VALUES (?, ?, ?, ?, 0)
          `,
          enqueueRows: outboxMessages.map((m: OutboxMessage) => [m.messageId, m.recipient, m.payload, now]),
        });
      },
      async listRecoverable() {
        const rows = store.transactionalSync((tx) => tx.all<NegotiationRow>(LIST_RECOVERABLE_SQL));
        return rows.map(rowToNegotiation);
      },
    };
  }

  // ── PurchaseStore ─────────────────────────────────────────────────────────

  private createPurchaseStore(): PurchaseStore {
    const store = this.store;
    const INSERT_SQL = `
      INSERT INTO purchases (purchase_id, record_json, revision, status, updated_at)
       VALUES (?, ?, ?, ?, ?)
    `;
    const GET_SQL = `SELECT * FROM purchases WHERE purchase_id = ?`;
    const CAS_SQL = `
      UPDATE purchases
       SET record_json = ?, revision = ?, status = ?, updated_at = ?
       WHERE purchase_id = ? AND revision = ?
    `;
    const LIST_RECOVERABLE_SQL = `
      SELECT * FROM purchases WHERE status NOT IN ('COMPLETED','FAILED','CANCELLED')
    `;

    return {
      async create(record) {
        const row = purchaseToRow(record);
        store.transactionalSync((tx) => {
          tx.run(INSERT_SQL, row.purchase_id, row.record_json, row.revision, row.status, row.updated_at);
        });
      },
      async get(purchaseId) {
        const row = store.transactionalSync((tx) => tx.get<PurchaseRow>(GET_SQL, purchaseId));
        return row ? rowToPurchase(row) : undefined;
      },
      async compareAndSet(purchaseId, expectedRevision, next) {
        const row = purchaseToRow(next);
        const touched = store.transactionalSync((tx) =>
          tx.run(
            CAS_SQL,
            row.record_json, row.revision, row.status, row.updated_at,
            purchaseId, expectedRevision,
          ),
        );
        return touched === 1;
      },
      async listRecoverable() {
        const rows = store.transactionalSync((tx) => tx.all<PurchaseRow>(LIST_RECOVERABLE_SQL));
        return rows.map(rowToPurchase);
      },
    };
  }

  // ── ReplayLedger ──────────────────────────────────────────────────────────

  private createReplayLedger(): ReplayLedger {
    const store = this.store;
    const GET_SQL = `SELECT * FROM replay WHERE message_id = ?`;
    const INSERT_PROCESSING_SQL = `
      INSERT INTO replay (message_id, state, claimed_at, lease_until)
       VALUES (?, 'PROCESSING', ?, ?)
    `;
    const UPDATE_PROCESSING_SQL = `
      UPDATE replay SET claimed_at = ?, lease_until = ? WHERE message_id = ? AND state = 'PROCESSING'
    `;
    const COMPLETE_SQL = `
      UPDATE replay SET state = 'COMPLETED', outcome_json = ?, completed_at = ?
       WHERE message_id = ?
    `;

    return {
      async claim(messageId, receivedAt, leaseMs = 30_000) {
        return store.transactionalSync((tx) => {
          const row = tx.get<ReplayRow>(GET_SQL, messageId);
          if (!row) {
            tx.run(INSERT_PROCESSING_SQL, messageId, receivedAt, receivedAt + leaseMs);
            return { claimed: true as const };
          }
          if (row.state === 'COMPLETED') {
            return { claimed: false as const, entry: rowToReplay(row) };
          }
          // PROCESSING — reclaim if lease expired.
          if (row.lease_until !== null && receivedAt > row.lease_until) {
            tx.run(UPDATE_PROCESSING_SQL, receivedAt, receivedAt + leaseMs, messageId);
            return { claimed: true as const, reclaimed: true as const };
          }
          return { claimed: false as const, entry: rowToReplay(row) };
        });
      },
      async complete(messageId, outcome) {
        store.transactionalSync((tx) => {
          tx.run(COMPLETE_SQL, toJson(outcome), Date.now(), messageId);
        });
      },
      async get(messageId) {
        const row = store.transactionalSync((tx) => tx.get<ReplayRow>(GET_SQL, messageId));
        return row ? rowToReplay(row) : undefined;
      },
    };
  }

  // ── PrincipalNegotiationStore ────────────────────────────────────────────

  private createPrincipalStore(): PrincipalNegotiationStore {
    const store = this.store;
    const INSERT_SLOT_SQL = `
      INSERT INTO principal_slots (principal, negotiation_id, opened_at) VALUES (?, ?, ?)
    `;
    const DELETE_SLOT_SQL = `
      DELETE FROM principal_slots WHERE principal = ? AND negotiation_id = ?
    `;
    const SLOTS_FOR_SQL = `SELECT * FROM principal_slots WHERE principal = ?`;
    const GET_COOLDOWN_SQL = `SELECT cooldown_until FROM principal_cooldown WHERE principal = ?`;
    const SET_COOLDOWN_SQL = `
      INSERT OR REPLACE INTO principal_cooldown (principal, cooldown_until) VALUES (?, ?)
    `;

    return {
      async tryOpen(principal, negotiationId, now, limits) {
        // Atomic on the shared transaction primitive: check cooldown, window,
        // concurrency, then consume — two concurrent opens cannot both pass.
        return store.transactionalSync((tx) => {
          const cooldownRow = tx.get<{ cooldown_until: number }>(GET_COOLDOWN_SQL, principal);
          if (cooldownRow && now < cooldownRow.cooldown_until) {
            return { allowed: false as const, reason: 'COOLDOWN' as const };
          }
          const slots = tx.all<PrincipalSlotRow>(SLOTS_FOR_SQL, principal);
          const recent = slots.filter((s) => now - s.opened_at < limits.windowMs);
          if (recent.length >= limits.maxNegotiationsPerWindow) {
            return { allowed: false as const, reason: 'WINDOW_LIMIT' as const };
          }
          if (slots.length >= limits.maxConcurrentNegotiations) {
            return { allowed: false as const, reason: 'CONCURRENCY_LIMIT' as const };
          }
          tx.run(INSERT_SLOT_SQL, principal, negotiationId, now);
          return { allowed: true as const };
        });
      },
      async close(principal, negotiationId) {
        store.transactionalSync((tx) => {
          tx.run(DELETE_SLOT_SQL, principal, negotiationId);
        });
      },
      async reconcile(principal, activeNegotiationIds) {
        store.transactionalSync((tx) => {
          const slots = tx.all<PrincipalSlotRow>(SLOTS_FOR_SQL, principal);
          const active = new Set(activeNegotiationIds);
          for (const slot of slots) {
            if (!active.has(slot.negotiation_id)) {
              tx.run(DELETE_SLOT_SQL, principal, slot.negotiation_id);
            }
          }
        });
      },
      async getCooldownUntil(principal) {
        const row = store.transactionalSync((tx) =>
          tx.get<{ cooldown_until: number }>(GET_COOLDOWN_SQL, principal),
        );
        return row?.cooldown_until ?? 0;
      },
      async setCooldownUntil(principal, until) {
        store.transactionalSync((tx) => {
          tx.run(SET_COOLDOWN_SQL, principal, until);
        });
      },
    };
  }

  // ── OutboxStore ───────────────────────────────────────────────────────────

  private createOutboxStore(): OutboxStore {
    const store = this.store;
    const ENQUEUE_SQL = `
      INSERT OR REPLACE INTO outbox (message_id, recipient, payload, enqueued_at, attempts)
       VALUES (?, ?, ?, ?, ?)
    `;
    const LIST_UNDELIVERED_SQL = `SELECT * FROM outbox WHERE delivered_at IS NULL`;
    const MARK_DELIVERED_SQL = `UPDATE outbox SET delivered_at = ? WHERE message_id = ?`;
    const RECORD_ATTEMPT_SQL = `UPDATE outbox SET attempts = attempts + 1 WHERE message_id = ?`;

    return {
      async enqueue(entry) {
        store.transactionalSync((tx) => {
          tx.run(
            ENQUEUE_SQL,
            entry.messageId, entry.recipient, toJson(entry.message), entry.enqueuedAt, entry.attempts,
          );
        });
      },
      async listUndelivered() {
        const rows = store.transactionalSync((tx) => tx.all<OutboxRow>(LIST_UNDELIVERED_SQL));
        return rows.map(rowToOutbox);
      },
      async markDelivered(messageId, deliveredAt) {
        store.transactionalSync((tx) => {
          tx.run(MARK_DELIVERED_SQL, deliveredAt, messageId);
        });
      },
      async recordAttempt(messageId) {
        store.transactionalSync((tx) => {
          tx.run(RECORD_ATTEMPT_SQL, messageId);
        });
      },
    };
  }
}

/**
 * Create a SQLite-backed CommerceStore.
 *
 * @param config filename (or ':memory:') + WAL/busy options.
 */
export function createSQLiteCommerceStore(config: SQLiteCommerceStoreConfig): SQLiteCommerceStore {
  return new SQLiteCommerceStore(config);
}