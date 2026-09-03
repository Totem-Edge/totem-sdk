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
 *
 * `transitionAndEnqueue` performs a negotiation state CAS AND an outbox
 * enqueue in ONE durable transaction. This gives the genuine guarantee:
 *
 *   economic transition + protocol response = one durable commit
 *
 * Without this, the persist-then-send crash window remains between the
 * separate CAS and enqueue calls.
 */

import type { NegotiationRecord } from './state.js';
import type { PurchaseRecord } from './purchase.js';
import { InMemoryOutboxStore, type OutboxEntry, type OutboxStore } from './outbox.js';

/** An outbound message to enqueue atomically with a state transition. */
export interface OutboxMessage {
  messageId: string;
  recipient: string;
  /** The wire message (canonical JSON string). */
  payload: string;
}

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
  /**
   * Atomically perform a negotiation CAS AND enqueue outbox messages in ONE
   * durable transaction. Returns false when the CAS failed (stale revision).
   *
   * For SQLite/Postgres this MUST be a single DB transaction so that the
   * economic transition and the protocol response commit or fail together.
   *
   * The default falls back to a two-step (non-transactional) sequence. A
   * durable store MUST override this to keep the crash window closed.
   */
  transitionAndEnqueue(
    negotiationId: string,
    expectedRevision: number,
    next: NegotiationRecord,
    outboxMessages: OutboxMessage[],
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
   *
   * Each consumed slot is bound to its `negotiationId` so recovery can
   * reconcile open slots against actual negotiation records — a crashed
   * process cannot leak capacity permanently.
   */
  tryOpen(
    principal: string,
    negotiationId: string,
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
  /**
   * Atomically release capacity for a principal for a specific negotiation.
   * Safe to call multiple times (no double-release).
   */
  close(principal: string, negotiationId: string): Promise<void>;
  /**
   * Reconcile open slots against the set of still-active negotiation IDs.
   * Any slot whose negotiation is terminal, expired, or no longer present is
   * released. This is the recovery hook that prevents capacity leaks when a
   * process crashes before close().
   */
  reconcile(
    principal: string,
    activeNegotiationIds: string[],
  ): Promise<void>;
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
  private readonly outbox: InMemoryOutboxStore;
  /** A simple FIFO promise queue so concurrent transitionAndEnqueue calls
   *  serialize within a single process (atomic within the process). */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(outbox?: InMemoryOutboxStore) {
    this.outbox = outbox ?? new InMemoryOutboxStore();
  }

  private enqueueLock<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    // Keep the chain alive regardless of errors.
    this.queue = next.catch(() => undefined);
    return next;
  }

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
    return this.enqueueLock(async () => {
      const current = this.records.get(negotiationId);
      if (!current) return false;
      if (current.revision !== expectedRevision) return false;
      this.records.set(negotiationId, next);
      return true;
    });
  }

  async transitionAndEnqueue(
    negotiationId: string,
    expectedRevision: number,
    next: NegotiationRecord,
    outboxMessages: OutboxMessage[],
  ): Promise<boolean> {
    // Atomic within the process: serialize via the promise queue so the CAS
    // and all enqueues commit together, or not at all on CAS failure.
    return this.enqueueLock(async () => {
      const current = this.records.get(negotiationId);
      if (!current) return false;
      if (current.revision !== expectedRevision) return false;
      this.records.set(negotiationId, next);
      for (const msg of outboxMessages) {
        const entry: OutboxEntry = {
          messageId: msg.messageId,
          recipient: msg.recipient,
          message: JSON.parse(msg.payload) as OutboxEntry['message'],
          enqueuedAt: Date.now(),
          attempts: 0,
        };
        await this.outbox.enqueue(entry);
      }
      return true;
    });
  }

  /** Expose the outbox read/write surface (dev mode + tests). */
  getOutbox(): OutboxStore {
    return this.outbox;
  }

  async listUndelivered(): Promise<OutboxEntry[]> {
    return this.outbox.listUndelivered();
  }

  async markOutboxDelivered(messageId: string): Promise<void> {
    await this.outbox.markDelivered(messageId, Date.now());
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
  /** Active slots: negotiationId → openedAt, per principal. */
  private readonly slots = new Map<string, Map<string, number>>();
  private readonly cooldown = new Map<string, number>();
  /** Simple FIFO queue so tryOpen/close/reconcile serialize within the process. */
  private queue: Promise<unknown> = Promise.resolve();

  private lock<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => undefined);
    return next;
  }

  async tryOpen(
    principal: string,
    negotiationId: string,
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
    return this.lock(async () => {
      // Cooldown check.
      const cooldownUntil = this.cooldown.get(principal) ?? 0;
      if (now < cooldownUntil) {
        return { allowed: false, reason: 'COOLDOWN' };
      }

      const principalSlots = this.slots.get(principal) ?? new Map<string, number>();

      // Window check (recent opens within the window).
      const recent = [...principalSlots.values()].filter((t) => now - t < limits.windowMs);
      if (recent.length >= limits.maxNegotiationsPerWindow) {
        return { allowed: false, reason: 'WINDOW_LIMIT' };
      }

      // Concurrency check (all slots are active, since close/reconcile remove them).
      if (principalSlots.size >= limits.maxConcurrentNegotiations) {
        return { allowed: false, reason: 'CONCURRENCY_LIMIT' };
      }

      // Consume capacity atomically, bound to this negotiation.
      principalSlots.set(negotiationId, now);
      this.slots.set(principal, principalSlots);
      return { allowed: true };
    });
  }

  async close(principal: string, negotiationId: string): Promise<void> {
    await this.lock(async () => {
      const principalSlots = this.slots.get(principal);
      if (principalSlots) {
        principalSlots.delete(negotiationId);
        if (principalSlots.size === 0) this.slots.delete(principal);
      }
    });
  }

  async reconcile(principal: string, activeNegotiationIds: string[]): Promise<void> {
    await this.lock(async () => {
      const principalSlots = this.slots.get(principal);
      if (!principalSlots) return;
      const active = new Set(activeNegotiationIds);
      for (const id of [...principalSlots.keys()]) {
        // Release slots whose negotiation is no longer present (terminal,
        // expired, or never persisted).
        if (!active.has(id)) principalSlots.delete(id);
      }
      if (principalSlots.size === 0) this.slots.delete(principal);
    });
  }

  async getCooldownUntil(principal: string): Promise<number> {
    return this.cooldown.get(principal) ?? 0;
  }

  async setCooldownUntil(principal: string, until: number): Promise<void> {
    this.cooldown.set(principal, until);
  }
}
