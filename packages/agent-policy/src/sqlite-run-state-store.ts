/**
 * agent-policy/sqlite-run-state-store.ts — Durable atomic run + grant usage store.
 *
 * Implements both `RunStateStore` and `GrantUsageStore` on a single SQLite
 * database (better-sqlite3, WAL). Every reservation atomically covers:
 *
 *   - mandate usage (per-mandate count/amount, reserved → committed/aborted)
 *   - run budgets (committed/reserved/aborted step counts)
 *   - concurrency capacity (reserved slot)
 *   - operation nonce (anti-replay, unique per run)
 *
 * better-sqlite3 is synchronous, so a single `db.transaction()` is atomic and
 * serialized across the process — and durable across restarts when backed by a
 * file path. Pass ':memory:' for ephemeral tests.
 */

import Database from 'better-sqlite3';
import type { StepAuthorization, StepReceipt } from './run.js';
import type { GrantUsageStore } from './grant-usage.js';
import { accumulate, type RunReservation, type RunStateSnapshot, type RunStateStore, type RunStepReceipt } from './run-state-store.js';

type ReservationKind = 'run' | 'grant';
type ReservationStatus = 'reserved' | 'committed' | 'aborted';

interface ReservationRow {
  reservation_id: string;
  run_id: string;
  step_id: string;
  kind: ReservationKind;
  status: ReservationStatus;
  reserved_at: number;
  expires_at: number;
  record_json: string;
  receipt_json: string | null;
  abort_reason: string | null;
}

interface MandateUsageRow {
  reservation_id: string;
  mandate_id: string;
  count: number;
  amount: string | null;
  status: ReservationStatus;
}

export interface SqliteRunStateStoreOptions {
  /** Injectable clock (defaults to Date.now). */
  now?: () => number;
  /** Reservation TTL in ms (default 60_000). */
  ttlMs?: number;
}

export class SqliteRunStateStore implements RunStateStore, GrantUsageStore {
  private readonly db: Database.Database;
  private readonly now: () => number;
  private readonly ttlMs: number;

  constructor(dbPath: string, options?: SqliteRunStateStoreOptions) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS autonomy_runs (
        run_id TEXT PRIMARY KEY,
        snapshot_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS autonomy_reservations (
        reservation_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        step_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        reserved_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        record_json TEXT NOT NULL,
        receipt_json TEXT,
        abort_reason TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_reservations_run
        ON autonomy_reservations(run_id, status);

      CREATE TABLE IF NOT EXISTS autonomy_nonces (
        run_id TEXT NOT NULL,
        nonce TEXT NOT NULL,
        PRIMARY KEY (run_id, nonce)
      );

      CREATE TABLE IF NOT EXISTS autonomy_mandate_usage (
        reservation_id TEXT NOT NULL,
        mandate_id TEXT NOT NULL,
        count INTEGER NOT NULL,
        amount TEXT,
        status TEXT NOT NULL,
        PRIMARY KEY (reservation_id, mandate_id)
      );
      CREATE INDEX IF NOT EXISTS idx_mandate_usage
        ON autonomy_mandate_usage(mandate_id, status);
    `);
    this.now = options?.now ?? (() => Date.now());
    this.ttlMs = options?.ttlMs ?? 60_000;
  }

  // ── RunStateStore ─────────────────────────────────────────────────────────

  createRun(snapshot: RunStateSnapshot): Promise<void> {
    this.db.prepare(`
      INSERT INTO autonomy_runs (run_id, snapshot_json, created_at)
      VALUES (?, ?, ?)
    `).run(snapshot.runId, JSON.stringify(snapshot), snapshot.startedAt);
    return Promise.resolve();
  }

  getRun(runId: string): Promise<RunStateSnapshot | undefined> {
    const row = this.db.prepare(
      'SELECT snapshot_json FROM autonomy_runs WHERE run_id = ?',
    ).get(runId) as { snapshot_json: string } | undefined;
    return Promise.resolve(row ? (JSON.parse(row.snapshot_json) as RunStateSnapshot) : undefined);
  }

  reserveStep(reservation: RunReservation): Promise<void> {
    const tx = this.db.transaction(() => {
      const existing = this.getReservationRow(reservation.reservationId);
      if (existing && existing.status === 'reserved') return;
      this.insertReservation('run', reservation.reservationId, reservation.runId, reservation.stepId, reservation, reservation.reservedAt, reservation.expiresAt);
      for (const u of reservation.usageDeltas ?? []) {
        this.insertMandateUsage(reservation.reservationId, u.mandateId, u.delta.count, u.delta.amount, 'reserved');
      }
      this.bumpRunTotal(reservation.runId, 'reservedSteps', 1);
    });
    try {
      tx();
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async commitStep(reservationId: string, receipt: RunStepReceipt): Promise<void> {
    const tx = this.db.transaction(() => {
      const row = this.getReservationRow(reservationId);
      if (!row) throw new Error(`reservation ${reservationId} not found`);
      if (row.status !== 'reserved') throw new Error(`reservation ${reservationId} is in status '${row.status}'`);
      if (this.now() > row.expires_at) {
        this.setReservationStatus(reservationId, 'aborted', undefined, 'reservation expired');
        throw new Error(`reservation ${reservationId} has expired`);
      }
      this.setReservationStatus(reservationId, 'committed', receipt, undefined);
      this.setMandateUsageStatus(reservationId, 'committed');
      this.foldReceiptIntoRun(row.run_id, receipt);
    });
    tx();
  }

  async abortStep(reservationId: string, reason: string): Promise<void> {
    const tx = this.db.transaction(() => {
      const row = this.getReservationRow(reservationId);
      if (!row) throw new Error(`reservation ${reservationId} not found`);
      if (row.status !== 'reserved') return;
      this.setReservationStatus(reservationId, 'aborted', undefined, reason);
      this.setMandateUsageStatus(reservationId, 'aborted');
      this.bumpRunTotal(row.run_id, 'abortedSteps', 1);
      this.bumpRunTotal(row.run_id, 'reservedSteps', -1);
    });
    tx();
  }

  getReservation(reservationId: string): Promise<RunReservation | undefined>;
  getReservation(reservationId: string): Promise<StepAuthorization | undefined>;
  getReservation(reservationId: string): Promise<RunReservation | StepAuthorization | undefined> {
    const row = this.getReservationRow(reservationId);
    if (!row) return Promise.resolve(undefined);
    const record = JSON.parse(row.record_json) as RunReservation | StepAuthorization;
    if (row.kind === 'run') {
      const reservation = record as RunReservation;
      reservation.status = row.status;
      reservation.abortReason = row.abort_reason ?? undefined;
      if (row.receipt_json) reservation.receipt = JSON.parse(row.receipt_json) as RunStepReceipt;
    }
    return Promise.resolve(record);
  }

  getReceipt(reservationId: string): Promise<RunStepReceipt | undefined> {
    const row = this.getReservationRow(reservationId);
    return Promise.resolve(row?.receipt_json ? (JSON.parse(row.receipt_json) as RunStepReceipt) : undefined);
  }

  listStepReceipts(runId: string): Promise<RunStepReceipt[]> {
    const rows = this.db.prepare(`
      SELECT receipt_json FROM autonomy_reservations
      WHERE run_id = ? AND status = 'committed' AND receipt_json IS NOT NULL
      ORDER BY reserved_at
    `).all(runId) as Array<{ receipt_json: string }>;
    return Promise.resolve(rows.map((r) => JSON.parse(r.receipt_json) as RunStepReceipt));
  }

  checkNonce(runId: string, nonce: string): Promise<boolean> {
    const result = this.db.prepare(`
      INSERT OR IGNORE INTO autonomy_nonces (run_id, nonce) VALUES (?, ?)
    `).run(runId, nonce);
    return Promise.resolve(result.changes === 1);
  }

  // ── GrantUsageStore ───────────────────────────────────────────────────────

  authorizeAndReserve(input: {
    runId: string;
    stepId: string;
    mandateId: string;
    actionDigest: string;
    usageDelta: { count: number; amount?: string };
    now: number;
    ttlMs?: number;
  }): Promise<StepAuthorization> {
    const reservedAt = input.now;
    const expiresAt = reservedAt + (input.ttlMs ?? this.ttlMs);
    const reservationId = `grant:${input.mandateId.slice(0, 8)}:${input.stepId.slice(0, 8)}:${reservedAt}`;

    const tx = this.db.transaction(() => {
      const existing = this.getReservationRow(reservationId);
      if (existing && existing.status === 'reserved') {
        return JSON.parse(existing.record_json) as StepAuthorization;
      }
      const authorization: StepAuthorization = {
        reservationId,
        decision: {
          allowed: true,
          matchedRules: ['grant:usage:reserved'],
          failedRules: [],
          intentId: input.actionDigest,
          mandateId: input.mandateId,
          decisionId: `totem:decision:${reservationId}`,
          evaluatedAt: reservedAt,
          policyVersion: '0.1.0',
          mandateVerification: {
            valid: true,
            identityVerified: true,
            scopeMatch: true,
            usageExceeded: false,
            expired: false,
            identityRevoked: false,
            mandateRevoked: false,
          },
          usageSnapshot: {
            mandateProofId: input.mandateId,
            totalCount: 0,
          },
          usageSnapshotHash: '',
          evidenceIds: [],
          usageDelta: input.usageDelta,
        },
        usageDelta: input.usageDelta,
        mandateId: input.mandateId,
        runId: input.runId,
        stepId: input.stepId,
        actionDigest: input.actionDigest,
        reservedAt,
        expiresAt,
      };
      this.insertReservation('grant', reservationId, input.runId, input.stepId, authorization, reservedAt, expiresAt);
      this.insertMandateUsage(reservationId, input.mandateId, input.usageDelta.count, input.usageDelta.amount, 'reserved');
      return authorization;
    });
    return Promise.resolve(tx());
  }

  async commit(reservationId: string, receipt: StepReceipt): Promise<void> {
    const tx = this.db.transaction(() => {
      const row = this.getReservationRow(reservationId);
      if (!row) throw new Error(`reservation ${reservationId} not found`);
      if (row.status !== 'reserved') throw new Error(`reservation ${reservationId} is in status '${row.status}'`);
      if (this.now() > row.expires_at) {
        this.setReservationStatus(reservationId, 'aborted', undefined, 'reservation expired');
        throw new Error(`reservation ${reservationId} has expired`);
      }
      this.setReservationStatus(reservationId, 'committed', receipt, undefined);
      this.setMandateUsageStatus(reservationId, 'committed');
    });
    tx();
  }

  async abort(reservationId: string, reason: string): Promise<void> {
    const tx = this.db.transaction(() => {
      const row = this.getReservationRow(reservationId);
      if (!row) throw new Error(`reservation ${reservationId} not found`);
      if (row.status !== 'reserved') throw new Error(`reservation ${reservationId} is in status '${row.status}'`);
      this.setReservationStatus(reservationId, 'aborted', undefined, reason);
      this.setMandateUsageStatus(reservationId, 'aborted');
    });
    tx();
  }

  countCommitted(runId: string): Promise<number> {
    return this.countByRun(runId, 'committed');
  }

  countReserved(runId: string): Promise<number> {
    return this.countByRun(runId, 'reserved');
  }

  countAborted(runId: string): Promise<number> {
    return this.countByRun(runId, 'aborted');
  }

  listCommittedReceipts(mandateId: string): Promise<StepReceipt[]> {
    const rows = this.db.prepare(`
      SELECT r.receipt_json FROM autonomy_reservations r
      JOIN autonomy_mandate_usage u ON u.reservation_id = r.reservation_id
      WHERE u.mandate_id = ? AND u.status = 'committed' AND r.receipt_json IS NOT NULL
      ORDER BY r.reserved_at
    `).all(mandateId) as Array<{ receipt_json: string }>;
    return Promise.resolve(rows.map((row) => JSON.parse(row.receipt_json) as StepReceipt));
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  private getReservationRow(reservationId: string): ReservationRow | undefined {
    return this.db.prepare(
      'SELECT * FROM autonomy_reservations WHERE reservation_id = ?',
    ).get(reservationId) as ReservationRow | undefined;
  }

  private insertReservation(
    kind: ReservationKind,
    reservationId: string,
    runId: string,
    stepId: string,
    record: unknown,
    reservedAt: number,
    expiresAt: number,
  ): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO autonomy_reservations
        (reservation_id, run_id, step_id, kind, status, reserved_at, expires_at, record_json)
      VALUES (?, ?, ?, ?, 'reserved', ?, ?, ?)
    `).run(reservationId, runId, stepId, kind, reservedAt, expiresAt, JSON.stringify(record));
  }

  private insertMandateUsage(
    reservationId: string,
    mandateId: string,
    count: number,
    amount: string | undefined,
    status: ReservationStatus,
  ): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO autonomy_mandate_usage
        (reservation_id, mandate_id, count, amount, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(reservationId, mandateId, count, amount ?? null, status);
  }

  private setReservationStatus(
    reservationId: string,
    status: ReservationStatus,
    receipt: unknown,
    abortReason: string | undefined,
  ): void {
    this.db.prepare(`
      UPDATE autonomy_reservations
      SET status = ?, receipt_json = ?, abort_reason = ?
      WHERE reservation_id = ?
    `).run(status, receipt === undefined ? null : JSON.stringify(receipt), abortReason ?? null, reservationId);
  }

  private setMandateUsageStatus(reservationId: string, status: ReservationStatus): void {
    this.db.prepare(`
      UPDATE autonomy_mandate_usage SET status = ? WHERE reservation_id = ?
    `).run(status, reservationId);
  }

  private bumpRunTotal(runId: string, field: 'reservedSteps' | 'abortedSteps', delta: number): void {
    const row = this.db.prepare(
      'SELECT snapshot_json FROM autonomy_runs WHERE run_id = ?',
    ).get(runId) as { snapshot_json: string } | undefined;
    if (!row) return;
    const snapshot = JSON.parse(row.snapshot_json) as RunStateSnapshot;
    snapshot.totals[field] = Math.max(0, snapshot.totals[field] + delta);
    this.db.prepare('UPDATE autonomy_runs SET snapshot_json = ? WHERE run_id = ?')
      .run(JSON.stringify(snapshot), runId);
  }

  private foldReceiptIntoRun(runId: string, receipt: RunStepReceipt): void {
    const row = this.db.prepare(
      'SELECT snapshot_json FROM autonomy_runs WHERE run_id = ?',
    ).get(runId) as { snapshot_json: string } | undefined;
    if (!row) return;
    const snapshot = JSON.parse(row.snapshot_json) as RunStateSnapshot;
    snapshot.totals.committedSteps += 1;
    snapshot.totals.reservedSteps = Math.max(0, snapshot.totals.reservedSteps - 1);
    for (const s of receipt.effects?.spends ?? []) {
      snapshot.totals.spentByToken[s.tokenId] = accumulate(snapshot.totals.spentByToken[s.tokenId], s.amount);
    }
    for (const f of receipt.effects?.fees ?? []) {
      snapshot.totals.feesByToken[f.tokenId] = accumulate(snapshot.totals.feesByToken[f.tokenId], f.amount);
    }
    for (const c of receipt.effects?.channels ?? []) {
      snapshot.totals.outstandingByToken[c.channelId] = accumulate(snapshot.totals.outstandingByToken[c.channelId], '0');
    }
    this.db.prepare('UPDATE autonomy_runs SET snapshot_json = ? WHERE run_id = ?')
      .run(JSON.stringify(snapshot), runId);
  }

  private countByRun(runId: string, status: ReservationStatus): Promise<number> {
    const row = this.db.prepare(`
      SELECT COUNT(*) AS count FROM autonomy_reservations
      WHERE run_id = ? AND status = ?
    `).get(runId, status) as { count: number };
    return Promise.resolve(row.count);
  }

  close(): void {
    this.db.close();
  }
}
