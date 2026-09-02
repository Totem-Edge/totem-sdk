/**
 * purchasing/store.ts — Durable persistence boundaries for machine commerce.
 *
 * Every persisted record carries a monotonically increasing `revision`.
 * All state-changing operations use atomic compare-and-set (CAS):
 *
 *   load state
 *   ↓
 *   validate expected revision/head/state
 *   ↓
 *   derive next state
 *   ↓
 *   compareAndSet(expectedRevision, next)
 *   ↓
 *   success OR retry/reject deterministically
 *
 * If another writer already advanced the record, the stale transition fails.
 * Do NOT implement durability with simple load/mutate/save without
 * concurrency protection.
 */

import type { NegotiationRecord } from './state.js';
import type { PurchaseRecord } from './purchase.js';

/** A durable negotiation store with atomic CAS semantics. */
export interface NegotiationStore {
  create(record: NegotiationRecord): Promise<void>;
  get(negotiationId: string): Promise<NegotiationRecord | undefined>;
  /**
   * Atomically replace the record only if its current revision equals
   * `expectedRevision`. Returns false when the record was advanced by
   * another writer (stale transition).
   */
  compareAndSet(
    negotiationId: string,
    expectedRevision: number,
    next: NegotiationRecord,
  ): Promise<boolean>;
  /** List recoverable (non-terminal) negotiations. */
  listRecoverable?(): Promise<NegotiationRecord[]>;
}

/** A durable purchase/session store with atomic CAS semantics. */
export interface PurchaseStore {
  create(record: PurchaseRecord): Promise<void>;
  get(purchaseId: string): Promise<PurchaseRecord | undefined>;
  compareAndSet(
    purchaseId: string,
    expectedRevision: number,
    next: PurchaseRecord,
  ): Promise<boolean>;
  listRecoverable?(): Promise<PurchaseRecord[]>;
}

/**
 * Per-principal anti-abuse accounting.
 *
 * Concurrent negotiations, cooldown, and window counts must not reset
 * trivially on process restart. This is protocol admission accounting only —
 * NOT a global reputation system.
 *
 * `tryOpen` is ATOMIC: checking limits and consuming capacity is one
 * operation. Two negotiations cannot simultaneously inspect a limit, both
 * decide admission is allowed, then both record themselves and exceed it.
 */
export interface PrincipalNegotiationStore {
  /**
   * Atomically check limits AND consume capacity. Returns `{ allowed: true }`
   * when the principal may open a negotiation, or a typed rejection reason.
   */
  tryOpen(
    principal: string,
    now: number,
    limits: {
      maxConcurrentNegotiations: number;
      cooldownMs: number;
      maxNegotiationsPerWindow: number;
      windowMs: number;
    },
  ): Promise<
    | { allowed: true }
    | { allowed: false; reason: 'CONCURRENCY_LIMIT' | 'COOLDOWN' | 'WINDOW_LIMIT' }
  >;
  /** Atomically release capacity for a principal (e.g. on terminal state). */
  close(principal: string, openedAt: number): Promise<void>;
  /** Get the cooldown-until timestamp for a principal (0 = none). */
  getCooldownUntil(principal: string): Promise<number>;
  /** Set the cooldown-until timestamp for a principal. */
  setCooldownUntil(principal: string, until: number): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory implementations (development / ephemeral mode)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * In-memory negotiation store. No crash guarantees — for development and
 * tests only. Production must supply a durable implementation.
 */
export class InMemoryNegotiationStore implements NegotiationStore {
  private readonly records = new Map<string, NegotiationRecord>();

  async create(record: NegotiationRecord): Promise<void> {
    if (this.records.has(record.negotiationId)) {
      throw new Error(`negotiation ${record.negotiationId} already exists`);
    }
    this.records.set(record.negotiationId, record);
  }

  async get(negotiationId: string): Promise<NegotiationRecord | undefined> {
    return this.records.get(negotiationId);
  }

  async compareAndSet(
    negotiationId: string,
    expectedRevision: number,
    next: NegotiationRecord,
  ): Promise<boolean> {
    const current = this.records.get(negotiationId);
    if (!current) return false;
    if (current.revision !== expectedRevision) return false;
    this.records.set(negotiationId, next);
    return true;
  }

  async listRecoverable(): Promise<NegotiationRecord[]> {
    return [...this.records.values()].filter(
      (r) => !['AGREED', 'REJECTED', 'CANCELLED', 'EXHAUSTED', 'EXPIRED'].includes(r.state),
    );
  }
}

/** In-memory purchase store. No crash guarantees — dev/test only. */
export class InMemoryPurchaseStore implements PurchaseStore {
  private readonly records = new Map<string, PurchaseRecord>();

  async create(record: PurchaseRecord): Promise<void> {
    if (this.records.has(record.purchaseId)) {
      throw new Error(`purchase ${record.purchaseId} already exists`);
    }
    this.records.set(record.purchaseId, record);
  }

  async get(purchaseId: string): Promise<PurchaseRecord | undefined> {
    return this.records.get(purchaseId);
  }

  async compareAndSet(
    purchaseId: string,
    expectedRevision: number,
    next: PurchaseRecord,
  ): Promise<boolean> {
    const current = this.records.get(purchaseId);
    if (!current) return false;
    if (current.revision !== expectedRevision) return false;
    this.records.set(purchaseId, next);
    return true;
  }

  async listRecoverable(): Promise<PurchaseRecord[]> {
    return [...this.records.values()].filter(
      (r) => !['COMPLETED', 'FAILED', 'CANCELLED'].includes(r.status),
    );
  }
}

/** In-memory principal anti-abuse store. No crash guarantees — dev/test only. */
export class InMemoryPrincipalNegotiationStore implements PrincipalNegotiationStore {
  private readonly opened = new Map<string, number[]>();
  private readonly cooldown = new Map<string, number>();

  async tryOpen(
    principal: string,
    now: number,
    limits: {
      maxConcurrentNegotiations: number;
      cooldownMs: number;
      maxNegotiationsPerWindow: number;
      windowMs: number;
    },
  ): Promise<
    | { allowed: true }
    | { allowed: false; reason: 'CONCURRENCY_LIMIT' | 'COOLDOWN' | 'WINDOW_LIMIT' }
  > {
    // Cooldown check.
    const cooldownUntil = this.cooldown.get(principal) ?? 0;
    if (now < cooldownUntil) {
      return { allowed: false, reason: 'COOLDOWN' };
    }

    // Window check (recent opens within the window).
    const recent = (this.opened.get(principal) ?? []).filter((t) => now - t < limits.windowMs);
    if (recent.length >= limits.maxNegotiationsPerWindow) {
      return { allowed: false, reason: 'WINDOW_LIMIT' };
    }

    // Concurrency check (active = opened minus closed).
    const active = (this.opened.get(principal) ?? []).length - (this.closed.get(principal) ?? 0);
    if (active >= limits.maxConcurrentNegotiations) {
      return { allowed: false, reason: 'CONCURRENCY_LIMIT' };
    }

    // Consume capacity atomically.
    const list = this.opened.get(principal) ?? [];
    list.push(now);
    this.opened.set(principal, list);
    return { allowed: true };
  }

  private readonly closed = new Map<string, number>();

  async close(principal: string, _openedAt: number): Promise<void> {
    this.closed.set(principal, (this.closed.get(principal) ?? 0) + 1);
  }

  async getCooldownUntil(principal: string): Promise<number> {
    return this.cooldown.get(principal) ?? 0;
  }

  async setCooldownUntil(principal: string, until: number): Promise<void> {
    this.cooldown.set(principal, until);
  }
}
