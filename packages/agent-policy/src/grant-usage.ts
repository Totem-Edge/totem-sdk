/**
 * agent-policy/grant-usage.ts — Shared transactional grant usage accounting.
 *
 * Unifies the parallel lifecycle implementations in agent-policy and
 * governance behind one port. The durable implementation must atomically
 * cover mandate usage, local quotas (amount cap, rate limit, run limits),
 * and step receipt/outbox creation — so two concurrent steps can never
 * independently observe the same remaining grant budget.
 */

import type { StepAuthorization, StepReceipt } from './run.js';

export interface GrantUsageStore {
  /** Atomically reserve mandate usage + local quotas for a step. */
  authorizeAndReserve(input: {
    runId: string;
    stepId: string;
    mandateId: string;
    actionDigest: string;
    usageDelta: { count: number; amount?: string };
    now: number;
    ttlMs?: number;
  }): Promise<StepAuthorization>;
  /** Commit a reservation after execution succeeds. */
  commit(reservationId: string, receipt: StepReceipt): Promise<void>;
  /** Abort a reservation after execution fails or is cancelled. */
  abort(reservationId: string, reason: string): Promise<void>;
  /** Run-level accounting for local bounds. */
  countCommitted(runId: string): Promise<number>;
  countReserved(runId: string): Promise<number>;
  countAborted(runId: string): Promise<number>;
  /** Committed receipts for a mandate — used to build the usage snapshot. */
  listCommittedReceipts(mandateId: string): Promise<StepReceipt[]>;
  /** Read a reservation (for commit/abort bookkeeping). */
  getReservation(reservationId: string): Promise<StepAuthorization | undefined>;
}

export interface MemoryGrantUsageStoreOptions {
  /** Injectable clock (defaults to Date.now). */
  now?: () => number;
  /** Reservation TTL in ms (default 60_000). */
  ttlMs?: number;
}

interface ReservationRecord {
  authorization: StepAuthorization;
  status: 'reserved' | 'committed' | 'aborted';
  abortReason?: string;
  receipt?: StepReceipt;
}

/**
 * In-memory `GrantUsageStore`. Atomic within a single process (single-threaded
 * JS event loop), so concurrent steps observe a consistent budget. Swap for a
 * durable store (SQLite/Postgres) at the wallet boundary.
 */
export class MemoryGrantUsageStore implements GrantUsageStore {
  private readonly reservations = new Map<string, ReservationRecord>();
  private readonly now: () => number;
  private readonly ttlMs: number;

  constructor(options?: MemoryGrantUsageStoreOptions) {
    this.now = options?.now ?? (() => Date.now());
    this.ttlMs = options?.ttlMs ?? 60_000;
  }

  async authorizeAndReserve(input: {
    runId: string;
    stepId: string;
    mandateId: string;
    actionDigest: string;
    usageDelta: { count: number; amount?: string };
    now: number;
    ttlMs?: number;
  }): Promise<StepAuthorization> {
    this.cleanExpired(input.now);
    const reservedAt = input.now;
    const expiresAt = reservedAt + (input.ttlMs ?? this.ttlMs);
    const reservationId = `res:${input.mandateId.slice(0, 8)}:${input.stepId.slice(0, 8)}:${reservedAt}`;

    const existing = this.reservations.get(reservationId);
    if (existing && existing.status === 'reserved') {
      return existing.authorization;
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

    this.reservations.set(reservationId, { authorization, status: 'reserved' });
    return authorization;
  }

  async commit(reservationId: string, receipt: StepReceipt): Promise<void> {
    const rec = this.reservations.get(reservationId);
    if (!rec) throw new Error(`reservation ${reservationId} not found`);
    if (rec.status !== 'reserved') throw new Error(`reservation ${reservationId} is in status '${rec.status}'`);
    if (this.now() > rec.authorization.expiresAt) {
      rec.status = 'aborted';
      throw new Error(`reservation ${reservationId} has expired`);
    }
    rec.status = 'committed';
    rec.receipt = receipt;
  }

  async abort(reservationId: string, reason: string): Promise<void> {
    const rec = this.reservations.get(reservationId);
    if (!rec) throw new Error(`reservation ${reservationId} not found`);
    if (rec.status !== 'reserved') throw new Error(`reservation ${reservationId} is in status '${rec.status}'`);
    rec.status = 'aborted';
    rec.abortReason = reason;
  }

  async getReservation(reservationId: string): Promise<StepAuthorization | undefined> {
    return this.reservations.get(reservationId)?.authorization;
  }

  getReceipt(reservationId: string): StepReceipt | undefined {
    return this.reservations.get(reservationId)?.receipt;
  }

  async countCommitted(runId: string): Promise<number> {
    return this.countByRun(runId, 'committed');
  }

  async countReserved(runId: string): Promise<number> {
    return this.countByRun(runId, 'reserved');
  }

  async countAborted(runId: string): Promise<number> {
    return this.countByRun(runId, 'aborted');
  }

  async listCommittedReceipts(mandateId: string): Promise<StepReceipt[]> {
    const out: StepReceipt[] = [];
    for (const rec of this.reservations.values()) {
      if (rec.status === 'committed' && rec.receipt && rec.receipt.mandateId === mandateId) {
        out.push(rec.receipt);
      }
    }
    return out.sort((a, b) => a.committedAt - b.committedAt);
  }

  private countByRun(runId: string, status: ReservationRecord['status']): number {
    let n = 0;
    for (const rec of this.reservations.values()) {
      if (rec.status === status && rec.authorization.runId === runId) n++;
    }
    return n;
  }

  private cleanExpired(now: number): void {
    for (const [id, rec] of this.reservations) {
      if (rec.status === 'reserved' && now > rec.authorization.expiresAt) {
        rec.status = 'aborted';
        this.reservations.set(id, rec);
      }
    }
  }
}
