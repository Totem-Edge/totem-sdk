/**
 * agent-policy/run-state-store.ts — Atomic run session state.
 *
 * One reservation must atomically cover mandate usage, agent-policy
 * rate/amount limits, run budgets, concurrency capacity and the operation
 * nonce. This store is the single place run-level state is kept. The in-memory
 * implementation is correct within one process (single-threaded event loop);
 * a durable implementation (SQLite/Postgres) is a drop-in replacement.
 */

import type { CanonicalAgentAction } from './run.js';

export interface RunSessionTotals {
  committedSteps: number;
  reservedSteps: number;
  abortedSteps: number;
  spentByToken: Record<string, string>;
  feesByToken: Record<string, string>;
  outstandingByToken: Record<string, string>;
  usedNonces: string[];
}

export interface RunStateSnapshot {
  runId: string;
  profileId: string;
  principal: string;
  agentId: string;
  grantProofIds: string[];
  startedAt: number;
  deadlineAt?: number;
  totals: RunSessionTotals;
}

export interface RunReservation {
  reservationId: string;
  runId: string;
  stepId: string;
  actionDigest: string;
  /** The action string (for transition validation across steps). */
  stepAction: string;
  /** The authorized step effects (for run-total folding on commit). */
  effects?: import('./run.js').StepEffects;
  reservedAt: number;
  expiresAt: number;
  status: 'reserved' | 'committed' | 'aborted';
  abortReason?: string;
  receipt?: RunStepReceipt;
  /** Mandates/decisions that authorized this step. */
  mandateIds?: string[];
  decisionIds?: string[];
}

export interface RunStepReceipt {
  reservationId: string;
  runId: string;
  stepId: string;
  actionDigest: string;
  committedAt: number;
  executionProof?: unknown;
  /** Mandates that authorized this step. */
  mandateIds: string[];
  /** Authority decision ids that authorized this step. */
  decisionIds: string[];
  /** Verified effects — folded into run totals on commit. */
  effects?: import('./run.js').StepEffects;
}

export interface RunStateStore {
  createRun(snapshot: RunStateSnapshot): Promise<void>;
  getRun(runId: string): Promise<RunStateSnapshot | undefined>;
  reserveStep(reservation: RunReservation): Promise<void>;
  commitStep(reservationId: string, receipt: RunStepReceipt): Promise<void>;
  abortStep(reservationId: string, reason: string): Promise<void>;
  getReservation(reservationId: string): Promise<RunReservation | undefined>;
  getReceipt(reservationId: string): Promise<RunStepReceipt | undefined>;
  listStepReceipts(runId: string): Promise<RunStepReceipt[]>;
  checkNonce(runId: string, nonce: string): Promise<boolean>;
}

export interface MemoryRunStateStoreOptions {
  now?: () => number;
}

export class MemoryRunStateStore implements RunStateStore {
  private readonly runs = new Map<string, RunStateSnapshot>();
  private readonly reservations = new Map<string, RunReservation>();
  private readonly receipts = new Map<string, RunStepReceipt>();
  private readonly now: () => number;

  constructor(options?: MemoryRunStateStoreOptions) {
    this.now = options?.now ?? (() => Date.now());
  }

  async createRun(snapshot: RunStateSnapshot): Promise<void> {
    if (this.runs.has(snapshot.runId)) {
      throw new Error(`run ${snapshot.runId} already exists`);
    }
    this.runs.set(snapshot.runId, snapshot);
  }

  async getRun(runId: string): Promise<RunStateSnapshot | undefined> {
    return this.runs.get(runId);
  }

  async reserveStep(reservation: RunReservation): Promise<void> {
    const existing = this.reservations.get(reservation.reservationId);
    if (existing && existing.status === 'reserved') return;
    this.reservations.set(reservation.reservationId, reservation);
    const run = this.runs.get(reservation.runId);
    if (run) {
      run.totals.reservedSteps += 1;
    }
  }

  async commitStep(reservationId: string, receipt: RunStepReceipt): Promise<void> {
    const res = this.reservations.get(reservationId);
    if (!res) throw new Error(`reservation ${reservationId} not found`);
    if (res.status !== 'reserved') throw new Error(`reservation ${reservationId} is in status '${res.status}'`);
    if (this.now() > res.expiresAt) {
      res.status = 'aborted';
      throw new Error(`reservation ${reservationId} has expired`);
    }
    res.status = 'committed';
    res.receipt = receipt;
    this.receipts.set(reservationId, receipt);

    const run = this.runs.get(res.runId);
    if (run) {
      run.totals.committedSteps += 1;
      run.totals.reservedSteps = Math.max(0, run.totals.reservedSteps - 1);
      // Fold verified step effects into run totals.
      for (const s of receipt.effects?.spends ?? []) {
        run.totals.spentByToken[s.tokenId] = accumulate(run.totals.spentByToken[s.tokenId], s.amount);
      }
      for (const f of receipt.effects?.fees ?? []) {
        run.totals.feesByToken[f.tokenId] = accumulate(run.totals.feesByToken[f.tokenId], f.amount);
      }
      for (const c of receipt.effects?.channels ?? []) {
        run.totals.outstandingByToken[c.channelId] = accumulate(run.totals.outstandingByToken[c.channelId], '0');
      }
    }
  }

  async abortStep(reservationId: string, reason: string): Promise<void> {
    const res = this.reservations.get(reservationId);
    if (!res) throw new Error(`reservation ${reservationId} not found`);
    if (res.status !== 'reserved') return;
    res.status = 'aborted';
    res.abortReason = reason;
    const run = this.runs.get(res.runId);
    if (run) {
      run.totals.abortedSteps += 1;
      run.totals.reservedSteps = Math.max(0, run.totals.reservedSteps - 1);
    }
  }

  async getReservation(reservationId: string): Promise<RunReservation | undefined> {
    return this.reservations.get(reservationId);
  }

  async getReceipt(reservationId: string): Promise<RunStepReceipt | undefined> {
    return this.receipts.get(reservationId);
  }

  async listStepReceipts(runId: string): Promise<RunStepReceipt[]> {
    const out: RunStepReceipt[] = [];
    for (const r of this.reservations.values()) {
      if (r.runId === runId && r.status === 'committed' && r.receipt) out.push(r.receipt);
    }
    return out.sort((a, b) => a.committedAt - b.committedAt);
  }

  async checkNonce(runId: string, nonce: string): Promise<boolean> {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`run ${runId} not found`);
    if (run.totals.usedNonces.includes(nonce)) return false;
    run.totals.usedNonces.push(nonce);
    return true;
  }
}

/** Decimal-safe token/amount accumulation (whole + 8dp fractional). */
const DECIMAL = /^[0-9]+(?:\.[0-9]+)?$/;
const SCALE = 100_000_000n;

function toScaled(v: string): bigint {
  if (!DECIMAL.test(v)) return 0n;
  const [whole, frac] = v.split('.');
  return BigInt(whole) * SCALE + BigInt((frac ?? '').padEnd(8, '0').slice(0, 8) || '0');
}

function fromScaled(n: bigint): string {
  const whole = n / SCALE;
  const frac = (n % SCALE).toString().padStart(8, '0');
  return (whole.toString() + '.' + frac).replace(/\.?0+$/, '') || '0';
}

export function accumulate(a: string | undefined, b: string): string {
  return fromScaled(toScaled(a ?? '0') + toScaled(b));
}
