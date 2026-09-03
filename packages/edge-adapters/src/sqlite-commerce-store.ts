/**
 * sqlite-commerce-store.ts — Production SQLite-backed CommerceStore.
 *
 * Implements the five durable commerce contracts over ONE SQLite database:
 *   NegotiationStore, PurchaseStore, ReplayLedger, PrincipalNegotiationStore,
 *   OutboxStore.
 *
 * The critical guarantee — `transitionAndEnqueue` (negotiation CAS + outbox
 * enqueue) — maps to ONE SQLite transaction:
 *
 *   BEGIN
 *   UPDATE negotiations SET ... WHERE negotiation_id=? AND revision=?
 *   INSERT INTO outbox (...) VALUES (...)
 *   COMMIT   (or ROLLBACK)
 *
 * CAS is real: `UPDATE ... WHERE revision = ?` and we verify exactly one row
 * changed. Replay claims and principal admission are likewise atomic via
 * single-statement upserts / transactions.
 *
 * Uses WAL mode + busy_timeout for concurrent runtime use. Does NOT persist
 * private keys — only stable references/IDs.
 *
 * All statements use positional `?` parameters so the same SQL runs on the
 * real better-sqlite3 native binding and the node:sqlite jest mock.
 */

import Database from 'better-sqlite3';
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
// SQLite CommerceStore
// ─────────────────────────────────────────────────────────────────────────────

export class SQLiteCommerceStore implements CommerceStore {
  readonly negotiations: NegotiationStore;
  readonly purchases: PurchaseStore;
  readonly replay: ReplayLedger;
  readonly principals: PrincipalNegotiationStore;
  readonly outbox: OutboxStore;

  private readonly db: Database.Database;

  constructor(config: SQLiteCommerceStoreConfig) {
    this.db = new Database(config.filename);
    this.db.pragma(`journal_mode = ${config.wal === false ? 'DELETE' : 'WAL'}`);
    this.db.pragma(`busy_timeout = ${config.busyTimeoutMs ?? 5000}`);
    this.migrate();

    this.negotiations = this.createNegotiationStore();
    this.purchases = this.createPurchaseStore();
    this.replay = this.createReplayLedger();
    this.principals = this.createPrincipalStore();
    this.outbox = this.createOutboxStore();
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    this.db.exec(`
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
    `);
  }

  // ── NegotiationStore ──────────────────────────────────────────────────────

  private createNegotiationStore(): NegotiationStore {
    const db = this.db;
    const insert = db.prepare(
      `INSERT INTO negotiations (negotiation_id, record_json, revision, state, principal, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const get = db.prepare(
      `SELECT * FROM negotiations WHERE negotiation_id = ?`,
    );
    const cas = db.prepare(
      `UPDATE negotiations
       SET record_json = ?, revision = ?, state = ?, updated_at = ?
       WHERE negotiation_id = ? AND revision = ?`,
    );
    const listRecoverable = db.prepare(
      `SELECT * FROM negotiations WHERE state NOT IN ('AGREED','REJECTED','CANCELLED','EXHAUSTED','EXPIRED')`,
    );

    return {
      async create(record) {
        const row = negotiationToRow(record);
        insert.run(
          row.negotiation_id, row.record_json, row.revision, row.state, row.principal, row.updated_at,
        );
      },
      async get(negotiationId) {
        const row = get.get(negotiationId) as NegotiationRow | undefined;
        return row ? rowToNegotiation(row) : undefined;
      },
      async compareAndSet(negotiationId, expectedRevision, next) {
        const row = negotiationToRow(next);
        const result = cas.run(
          row.record_json, row.revision, row.state, row.updated_at,
          negotiationId, expectedRevision,
        );
        return result.changes === 1;
      },
      async transitionAndEnqueue(negotiationId, expectedRevision, next, outboxMessages) {
        // ONE transaction: CAS negotiation + insert outbox messages.
        // Uses explicit BEGIN/COMMIT/ROLLBACK so it works on both the real
        // better-sqlite3 native binding and the node:sqlite jest mock.
        db.exec('BEGIN');
        try {
          const row = negotiationToRow(next);
          const result = cas.run(
            row.record_json, row.revision, row.state, row.updated_at,
            negotiationId, expectedRevision,
          );
          if (result.changes !== 1) {
            db.exec('ROLLBACK');
            return false;
          }
          const insertOutbox = db.prepare(
            `INSERT OR REPLACE INTO outbox (message_id, recipient, payload, enqueued_at, attempts)
             VALUES (?, ?, ?, ?, 0)`,
          );
          for (const msg of outboxMessages) {
            insertOutbox.run(msg.messageId, msg.recipient, msg.payload, Date.now());
          }
          db.exec('COMMIT');
          return true;
        } catch (err) {
          db.exec('ROLLBACK');
          throw err;
        }
      },
      async listRecoverable() {
        const rows = listRecoverable.all() as NegotiationRow[];
        return rows.map(rowToNegotiation);
      },
    };
  }

  // ── PurchaseStore ─────────────────────────────────────────────────────────

  private createPurchaseStore(): PurchaseStore {
    const db = this.db;
    const insert = db.prepare(
      `INSERT INTO purchases (purchase_id, record_json, revision, status, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    );
    const get = db.prepare(`SELECT * FROM purchases WHERE purchase_id = ?`);
    const cas = db.prepare(
      `UPDATE purchases
       SET record_json = ?, revision = ?, status = ?, updated_at = ?
       WHERE purchase_id = ? AND revision = ?`,
    );
    const listRecoverable = db.prepare(
      `SELECT * FROM purchases WHERE status NOT IN ('COMPLETED','FAILED','CANCELLED')`,
    );

    return {
      async create(record) {
        const row = purchaseToRow(record);
        insert.run(row.purchase_id, row.record_json, row.revision, row.status, row.updated_at);
      },
      async get(purchaseId) {
        const row = get.get(purchaseId) as PurchaseRow | undefined;
        return row ? rowToPurchase(row) : undefined;
      },
      async compareAndSet(purchaseId, expectedRevision, next) {
        const row = purchaseToRow(next);
        const result = cas.run(
          row.record_json, row.revision, row.status, row.updated_at,
          purchaseId, expectedRevision,
        );
        return result.changes === 1;
      },
      async listRecoverable() {
        const rows = listRecoverable.all() as PurchaseRow[];
        return rows.map(rowToPurchase);
      },
    };
  }

  // ── ReplayLedger ──────────────────────────────────────────────────────────

  private createReplayLedger(): ReplayLedger {
    const db = this.db;
    const get = db.prepare(`SELECT * FROM replay WHERE message_id = ?`);
    const insertProcessing = db.prepare(
      `INSERT INTO replay (message_id, state, claimed_at, lease_until)
       VALUES (?, 'PROCESSING', ?, ?)`,
    );
    const updateProcessing = db.prepare(
      `UPDATE replay SET claimed_at = ?, lease_until = ? WHERE message_id = ? AND state = 'PROCESSING'`,
    );
    const complete = db.prepare(
      `UPDATE replay SET state = 'COMPLETED', outcome_json = ?, completed_at = ?
       WHERE message_id = ?`,
    );

    return {
      async claim(messageId, receivedAt, leaseMs = 30_000) {
        const row = get.get(messageId) as ReplayRow | undefined;
        if (!row) {
          insertProcessing.run(messageId, receivedAt, receivedAt + leaseMs);
          return { claimed: true };
        }
        if (row.state === 'COMPLETED') {
          return { claimed: false, entry: rowToReplay(row) };
        }
        // PROCESSING — reclaim if lease expired.
        if (row.lease_until !== null && receivedAt > row.lease_until) {
          updateProcessing.run(receivedAt, receivedAt + leaseMs, messageId);
          return { claimed: true, reclaimed: true };
        }
        return { claimed: false, entry: rowToReplay(row) };
      },
      async complete(messageId, outcome) {
        complete.run(toJson(outcome), Date.now(), messageId);
      },
      async get(messageId) {
        const row = get.get(messageId) as ReplayRow | undefined;
        return row ? rowToReplay(row) : undefined;
      },
    };
  }

  // ── PrincipalNegotiationStore ────────────────────────────────────────────

  private createPrincipalStore(): PrincipalNegotiationStore {
    const db = this.db;
    const insertSlot = db.prepare(
      `INSERT INTO principal_slots (principal, negotiation_id, opened_at) VALUES (?, ?, ?)`,
    );
    const deleteSlot = db.prepare(
      `DELETE FROM principal_slots WHERE principal = ? AND negotiation_id = ?`,
    );
    const slotsFor = db.prepare(
      `SELECT * FROM principal_slots WHERE principal = ?`,
    );
    const getCooldown = db.prepare(
      `SELECT cooldown_until FROM principal_cooldown WHERE principal = ?`,
    );
    const setCooldown = db.prepare(
      `INSERT OR REPLACE INTO principal_cooldown (principal, cooldown_until) VALUES (?, ?)`,
    );

    return {
      async tryOpen(principal, negotiationId, now, limits) {
        // Atomic: check cooldown, window, concurrency, then consume — all in
        // one transaction so two concurrent opens cannot both pass.
        db.exec('BEGIN');
        try {
          const cooldownRow = getCooldown.get(principal) as { cooldown_until: number } | undefined;
          if (cooldownRow && now < cooldownRow.cooldown_until) {
            db.exec('ROLLBACK');
            return { allowed: false as const, reason: 'COOLDOWN' as const };
          }
          const slots = slotsFor.all(principal) as PrincipalSlotRow[];
          const recent = slots.filter((s) => now - s.opened_at < limits.windowMs);
          if (recent.length >= limits.maxNegotiationsPerWindow) {
            db.exec('ROLLBACK');
            return { allowed: false as const, reason: 'WINDOW_LIMIT' as const };
          }
          if (slots.length >= limits.maxConcurrentNegotiations) {
            db.exec('ROLLBACK');
            return { allowed: false as const, reason: 'CONCURRENCY_LIMIT' as const };
          }
          insertSlot.run(principal, negotiationId, now);
          db.exec('COMMIT');
          return { allowed: true as const };
        } catch (err) {
          db.exec('ROLLBACK');
          throw err;
        }
      },
      async close(principal, negotiationId) {
        deleteSlot.run(principal, negotiationId);
      },
      async reconcile(principal, activeNegotiationIds) {
        db.exec('BEGIN');
        try {
          const slots = slotsFor.all(principal) as PrincipalSlotRow[];
          const active = new Set(activeNegotiationIds);
          for (const slot of slots) {
            if (!active.has(slot.negotiation_id)) {
              deleteSlot.run(principal, slot.negotiation_id);
            }
          }
          db.exec('COMMIT');
        } catch (err) {
          db.exec('ROLLBACK');
          throw err;
        }
      },
      async getCooldownUntil(principal) {
        const row = getCooldown.get(principal) as { cooldown_until: number } | undefined;
        return row?.cooldown_until ?? 0;
      },
      async setCooldownUntil(principal, until) {
        setCooldown.run(principal, until);
      },
    };
  }

  // ── OutboxStore ───────────────────────────────────────────────────────────

  private createOutboxStore(): OutboxStore {
    const db = this.db;
    const listUndelivered = db.prepare(
      `SELECT * FROM outbox WHERE delivered_at IS NULL`,
    );
    const markDelivered = db.prepare(
      `UPDATE outbox SET delivered_at = ? WHERE message_id = ?`,
    );
    const recordAttempt = db.prepare(
      `UPDATE outbox SET attempts = attempts + 1 WHERE message_id = ?`,
    );

    return {
      async enqueue(entry) {
        db.prepare(
          `INSERT OR REPLACE INTO outbox (message_id, recipient, payload, enqueued_at, attempts)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(entry.messageId, entry.recipient, toJson(entry.message), entry.enqueuedAt, entry.attempts);
      },
      async listUndelivered() {
        const rows = listUndelivered.all() as OutboxRow[];
        return rows.map(rowToOutbox);
      },
      async markDelivered(messageId, deliveredAt) {
        markDelivered.run(deliveredAt, messageId);
      },
      async recordAttempt(messageId) {
        recordAttempt.run(messageId);
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
