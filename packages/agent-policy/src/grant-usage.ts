/**
 * agent-policy/grant-usage.ts — Shared transactional grant usage accounting.
 *
 * Unifies the parallel lifecycle implementations in agent-policy and
 * governance behind one port. The durable implementation must atomically
 * cover mandate usage, local quotas (amount cap, rate limit, run limits),
 * and step receipt/outbox creation — so two concurrent steps can never
 * independently observe the same remaining grant budget.
 */

import type { UsageLimit } from '@totemsdk/authority';
import type { StepAuthorization, StepReceipt } from './run.js';
import type { OutOfBandReservation, ReservationSettlementOutcome } from './run-state-store.js';
import {
  assertSettlementInstruction,
  releasedUsage,
  sumReservedUsage,
  type ActualConsumptionV1,
  type SettlementInstructionV1,
  type TerminalOutcome,
} from './settlement.js';

/**
 * Thrown by `authorizeAndReserve` when the requested delta would exceed the
 * supplied mandate usage limit. The check and the reservation happen in one
 * critical section (AUD-020), so concurrent callers cannot each observe the
 * same remaining budget.
 */
export class GrantUsageLimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GrantUsageLimitExceededError';
  }
}

export interface GrantUsageStore {
  /**
   * Atomically reserve mandate usage + local quotas for a step.
   *
   * When `usageLimit` is supplied, the limit is enforced against committed +
   * reserved usage inside the same critical section as the reservation, so a
   * concurrent burst can never over-reserve the budget (AUD-020). Exceeding it
   * throws `GrantUsageLimitExceededError`.
   */
  authorizeAndReserve(input: {
    runId: string;
    stepId: string;
    mandateId: string;
    actionDigest: string;
    usageDelta: { count: number; amount?: string };
    now: number;
    ttlMs?: number;
    usageLimit?: UsageLimit;
  }): Promise<StepAuthorization>;
  /** Commit a reservation after execution succeeds. */
  commit(reservationId: string, receipt: StepReceipt): Promise<void>;
  /** Abort a reservation after execution fails or is cancelled. */
  abort(reservationId: string, reason: string): Promise<void>;
  /** Run-level accounting for local bounds. */
  countCommitted(runId: string): Promise<number>;
  countReserved(runId: string): Promise<number>;
  countAborted(runId: string): Promise<number>;
  /** Reservations whose outcome is unknown after crash/timeout — budget HELD. */
  countUnknown(runId: string): Promise<number>;
  /** Committed receipts for a mandate — used to build the usage snapshot. */
  listCommittedReceipts(mandateId: string): Promise<StepReceipt[]>;
  /** Read a reservation (for commit/abort bookkeeping). */
  getReservation(reservationId: string): Promise<StepAuthorization | undefined>;
  /**
   * Conservative reservation recovery: unsettled past-deadline reservations are
   * classified `unknown` and their budget is HELD until explicit reconciliation.
   */
  recoverReservations(runId?: string): Promise<OutOfBandReservation[]>;
  /**
   * Explicit settlement of a recovered (`unknown`) reservation. The only way
   * budget is released is `'definitely-not-executed'`; `'completed'` commits.
   */
  reconcileReservation(
    reservationId: string,
    outcome: ReservationSettlementOutcome,
    opts?: { receipt?: StepReceipt; reason?: string },
  ): Promise<void>;
  /** RFC-022 Amendment A: settle a grant reservation by verified actual use. */
  settleActual(instruction: SettlementInstructionV1): Promise<StepReceipt>;
  /** Extend a still-reserved grant lease before expiry. */
  renewReservation(reservationId: string, extendsTo: number, now?: number): Promise<void>;
}

export interface MemoryGrantUsageStoreOptions {
  /** Injectable clock (defaults to Date.now). */
  now?: () => number;
  /** Reservation TTL in ms (default 60_000). */
  ttlMs?: number;
}

interface ReservationRecord {
  authorization: StepAuthorization;
  status: 'reserved' | 'committed' | 'aborted' | 'unknown';
  abortReason?: string;
  receipt?: StepReceipt;
  /** Actual usage charged on settlement; reserved usage remains on the authorization. */
  actualUsageDelta?: { count: number; amount?: string };
  settlementId?: string;
  terminalOutcome?: TerminalOutcome;
  actualConsumption?: ActualConsumptionV1;
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
    usageLimit?: UsageLimit;
  }): Promise<StepAuthorization> {
    this.cleanExpired(input.now);
    const reservedAt = input.now;
    const expiresAt = reservedAt + (input.ttlMs ?? this.ttlMs);
    // Unique over the complete request binding (AUD-021): truncating the
    // mandate/step ids let unrelated runs/actions share a reservation id and
    // silently reuse each other's authorization.
    const reservationId = `res:${input.runId}:${input.stepId}:${input.mandateId}:${input.actionDigest}:${reservedAt}`;

    const existing = this.reservations.get(reservationId);
    if (existing && existing.status === 'reserved') {
      const a = existing.authorization;
      if (
        a.runId !== input.runId ||
        a.stepId !== input.stepId ||
        a.mandateId !== input.mandateId ||
        a.actionDigest !== input.actionDigest
      ) {
        throw new Error(`reservation id collision for ${reservationId}`);
      }
      return a;
    }

    // Atomic limit enforcement (AUD-020): committed + outstanding reserved usage
    // is checked in the same synchronous critical section that inserts the
    // reservation, so concurrent callers cannot each see the same free budget.
    if (input.usageLimit) {
      this.assertWithinLimit(input.mandateId, input.usageDelta, input.usageLimit, input.now);
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
      // Conservative: an expired, unsettled execution is outcome-unknown. The
      // budget stays HELD until the host reconciles it explicitly.
      rec.status = 'unknown';
      throw new Error(`reservation ${reservationId} has expired`);
    }
    rec.status = 'committed';
    rec.receipt = receipt;
    rec.actualUsageDelta = rec.authorization.usageDelta;
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

  async countUnknown(runId: string): Promise<number> {
    return this.countByRun(runId, 'unknown');
  }

  async recoverReservations(runId?: string): Promise<OutOfBandReservation[]> {
    this.cleanExpired(this.now());
    const unsettled: OutOfBandReservation[] = [];
    for (const rec of this.reservations.values()) {
      if (runId !== undefined && rec.authorization.runId !== runId) continue;
      if (rec.status === 'unknown') {
        const a = rec.authorization;
        unsettled.push({ reservationId: a.reservationId, runId: a.runId, stepId: a.stepId, kind: 'grant', reservedAt: a.reservedAt, expiresAt: a.expiresAt });
      }
    }
    return unsettled;
  }

  async reconcileReservation(
    reservationId: string,
    outcome: ReservationSettlementOutcome,
    opts?: { receipt?: StepReceipt; reason?: string },
  ): Promise<void> {
    const rec = this.reservations.get(reservationId);
    if (!rec) throw new Error(`reservation ${reservationId} not found`);
    const expired = rec.status === 'reserved' && this.now() > rec.authorization.expiresAt;
    if (expired) rec.status = 'unknown';
    if (rec.status !== 'unknown') throw new Error(`reservation ${reservationId} is in status '${rec.status}' — only unsettled reservations reconcile`);

    if (outcome === 'definitely-not-executed') {
      rec.status = 'aborted';
      rec.abortReason = opts?.reason ?? 'reconciled: definitely not executed';
      return;
    }

    rec.status = 'committed';
    rec.actualUsageDelta = rec.authorization.usageDelta;
    rec.receipt = opts?.receipt ?? {
      reservationId: rec.authorization.reservationId,
      runId: rec.authorization.runId,
      stepId: rec.authorization.stepId,
      mandateId: rec.authorization.mandateId,
      actionDigest: rec.authorization.actionDigest,
      committedAt: this.now(),
      usageDelta: rec.authorization.usageDelta,
    };
  }

  async settleActual(instruction: SettlementInstructionV1): Promise<StepReceipt> {
    const rec = this.reservations.get(instruction.reservationId);
    if (!rec) throw new Error(`reservation ${instruction.reservationId} not found`);

    if (rec.receipt?.settlementId === instruction.settlementId) return rec.receipt;
    if (rec.status === 'committed' || rec.status === 'aborted') {
      throw new Error(
        `reservation ${instruction.reservationId} is already settled; conflicting settlement ${instruction.settlementId}`,
      );
    }

    if (rec.status === 'reserved' && this.now() > rec.authorization.expiresAt) {
      rec.status = 'unknown';
      rec.abortReason = 'reservation expired';
    }

    assertSettlementInstruction(
      instruction,
      undefined,
      [{ mandateId: rec.authorization.mandateId, delta: rec.authorization.usageDelta }],
    );

    const reserved = sumReservedUsage([{
      mandateId: rec.authorization.mandateId,
      delta: rec.authorization.usageDelta,
    }]);
    const actualUsage = instruction.actual
      ? sumReservedUsage(instruction.actual.mandateUsage.map((u) => ({
        mandateId: u.mandateId,
        delta: { count: u.count, ...(u.amount !== undefined ? { amount: u.amount } : {}) },
      })))
      : undefined;
    const released = instruction.disposition === 'commit-reserved'
      ? (reserved.amount !== undefined ? { count: 0, amount: '0' } : { count: 0 })
      : releasedUsage(reserved, actualUsage);

    const receipt: StepReceipt = {
      reservationId: rec.authorization.reservationId,
      runId: rec.authorization.runId,
      stepId: rec.authorization.stepId,
      mandateId: rec.authorization.mandateId,
      actionDigest: rec.authorization.actionDigest,
      committedAt: this.now(),
      usageDelta: reserved,
      settlementId: instruction.settlementId,
      dispatchState: instruction.dispatchState,
      terminalOutcome: instruction.terminalOutcome,
      ...(instruction.actual !== undefined ? { actualConsumption: instruction.actual } : {}),
      reservedUsage: reserved,
      releasedUsage: released,
    };

    rec.receipt = receipt;
    rec.settlementId = instruction.settlementId;
    rec.terminalOutcome = instruction.terminalOutcome;
    if (instruction.actual !== undefined) rec.actualConsumption = instruction.actual;

    if (instruction.disposition === 'release-nonexecution') {
      rec.status = 'aborted';
      rec.abortReason = `settled: ${instruction.terminalOutcome} (not dispatched)`;
    } else {
      rec.status = 'committed';
      rec.actualUsageDelta = instruction.disposition === 'commit-reserved'
        ? rec.authorization.usageDelta
        : actualUsage;
    }

    return receipt;
  }

  async renewReservation(reservationId: string, extendsTo: number, now: number = this.now()): Promise<void> {
    const rec = this.reservations.get(reservationId);
    if (!rec) throw new Error(`reservation ${reservationId} not found`);
    if (rec.status !== 'reserved') {
      throw new Error(`reservation ${reservationId} is in status '${rec.status}' — only reserved leases renew`);
    }
    if (now > rec.authorization.expiresAt) {
      rec.status = 'unknown';
      throw new Error(`reservation ${reservationId} has expired and requires reconciliation, not renewal`);
    }
    if (!Number.isFinite(extendsTo) || extendsTo <= rec.authorization.expiresAt) {
      throw new Error(`reservation ${reservationId} renewal must extend past ${rec.authorization.expiresAt}`);
    }
    rec.authorization.expiresAt = extendsTo;
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
    // Expire stale reservations before counting (AUD-022): otherwise an
    // expired-but-unreconciled reservation keeps blocking the parallel-slot
    // precheck forever, since policy checks never reach authorizeAndReserve.
    this.cleanExpired(this.now());
    let n = 0;
    for (const rec of this.reservations.values()) {
      if (rec.status === status && rec.authorization.runId === runId) n++;
    }
    return n;
  }

  /** Committed + outstanding reserved usage for a mandate (windowed when asked). */
  private currentUsage(mandateId: string, now: number, windowMs?: number): { count: number; amount: bigint } {
    let windowStart: number | undefined;
    if (windowMs !== undefined && windowMs > 0) {
      windowStart = Math.floor(now / windowMs) * windowMs;
    }
    let count = 0;
    let amount = 0n;
    for (const rec of this.reservations.values()) {
      if (rec.authorization.mandateId !== mandateId) continue;
      if (rec.status !== 'committed' && rec.status !== 'reserved') continue;
      if (windowStart !== undefined && rec.authorization.reservedAt < windowStart) continue;
      const charged = rec.status === 'committed'
        ? (rec.actualUsageDelta ?? rec.authorization.usageDelta)
        : rec.authorization.usageDelta;
      count += charged.count;
      if (charged.amount !== undefined) {
        amount += BigInt(charged.amount);
      }
    }
    return { count, amount };
  }

  private assertWithinLimit(
    mandateId: string,
    delta: { count: number; amount?: string },
    limit: UsageLimit,
    now: number,
  ): void {
    const current = this.currentUsage(mandateId, now, limit.windowMs);
    if (limit.maxCount !== undefined && current.count + delta.count > limit.maxCount) {
      throw new GrantUsageLimitExceededError(
        `grant usage limit exceeded for mandate ${mandateId}: count ${current.count} + ${delta.count} > maxCount ${limit.maxCount}`,
      );
    }
    if (limit.maxTotal !== undefined) {
      const proposed = delta.amount !== undefined ? BigInt(delta.amount) : 0n;
      if (current.amount + proposed > BigInt(limit.maxTotal)) {
        throw new GrantUsageLimitExceededError(
          `grant usage limit exceeded for mandate ${mandateId}: amount ${current.amount} + ${proposed} > maxTotal ${limit.maxTotal}`,
        );
      }
    }
  }

  private cleanExpired(now: number): void {
    for (const [id, rec] of this.reservations) {
      // Conservative: never auto-release an unsettled reservation. Expiry
      // classifies it `unknown` (outcome-unknown) — the budget is HELD until
      // the host reconciles via `reconcileReservation`.
      if (rec.status === 'reserved' && now > rec.authorization.expiresAt) {
        rec.status = 'unknown';
        this.reservations.set(id, rec);
      }
    }
  }
}
