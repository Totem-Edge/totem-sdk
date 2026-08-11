import type { AgentProposal, PolicyEvalResult, PolicyMiddleware } from './types.js';
import { proposalPolicyDigest } from './digest.js';

/**
 * AmountCapPolicy — caps the total amount of MIN or tokens an agent can
 * spend per transaction and/or per day.
 *
 * Amounts are compared as BigInt. Only proposals with a numeric `amount`
 * are subject to caps — proposals without an amount pass through.
 *
 * The daily cap uses a fixed 24-hour window per principal and token.
 *
 * ## Lifecycle contract
 *
 * `evaluate()` is read-only and never mutates state. Quota is consumed only
 * through the reservation lifecycle:
 *
 *   reserve(proposal) → commit(proposal.id)   // on success
 *                      → release(proposal.id) // on failure
 *
 * Operation IDs are bound to a canonical digest of the full proposal. A retry
 * that reuses an operation ID with different contents is rejected. The
 * committed state is irreversible: `release` only refunds a `reserved`
 * operation and is a no-op on `committed` operations.
 *
 * @example
 * ```ts
 * // Max 500 MIN per transaction, 10_000 MIN per day
 * const amountCap = new AmountCapPolicy({ perTx: '500', perDay: '10000' });
 * ```
 */
export interface AmountCapConfig {
  /** Maximum amount per single transaction. */
  perTx?: string;
  /** Maximum total amount per fixed 24-hour window. */
  perDay?: string;
}

interface AmountOperation {
  key: string;
  amount: bigint;
  digest: string;
  status: 'reserved' | 'committed' | 'released';
}

export class AmountCapPolicy implements PolicyMiddleware {
  private readonly perTx: bigint | null;
  private readonly perDay: bigint | null;
  private readonly buckets = new Map<string, {
    dayStart: number;
    committed: bigint;
    reservations: Map<string, bigint>;
  }>();
  private readonly operations = new Map<string, AmountOperation>();

  constructor(config: AmountCapConfig) {
    this.perTx = config.perTx !== undefined ? BigInt(config.perTx) : null;
    this.perDay = config.perDay !== undefined ? BigInt(config.perDay) : null;
    if (this.perTx !== null && this.perTx < 0n) throw new Error('perTx must be non-negative');
    if (this.perDay !== null && this.perDay < 0n) throw new Error('perDay must be non-negative');
  }

  /**
   * Bucket key. Uses the authenticated principal when the trusted execution
   * boundary supplied one; `agentId` is caller-chosen and can be rotated, so
   * it is only ever a fallback for legacy callers that do not authenticate.
   */
  private keyFor(proposal: AgentProposal): string {
    const principal = proposal.principal ?? proposal.agentId;
    return `${principal}\u0000${proposal.intent.tokenId ?? 'native'}`;
  }

  /**
   * Read-only view of committed + reserved usage after applying any pending
   * day rollover. Never mutates state — `evaluate()` must remain read-only.
   */
  private windowUsage(key: string, now: number): { committed: bigint; reservedTotal: bigint } {
    const bucket = this.buckets.get(key);
    if (!bucket) return { committed: 0n, reservedTotal: 0n };
    if (now - bucket.dayStart >= 86_400_000) return { committed: 0n, reservedTotal: 0n };
    const reservedTotal = [...bucket.reservations.values()].reduce((sum, value) => sum + value, 0n);
    return { committed: bucket.committed, reservedTotal };
  }

  /**
   * Roll the day window forward when it has elapsed, releasing stale
   * reservations. Only the mutating lifecycle paths call this.
   */
  private rollover(key: string, now: number): void {
    const bucket = this.buckets.get(key);
    if (!bucket || now - bucket.dayStart < 86_400_000) return;
    for (const operationId of bucket.reservations.keys()) {
      const operation = this.operations.get(operationId);
      if (operation) operation.status = 'released';
    }
    bucket.dayStart = now;
    bucket.committed = 0n;
    bucket.reservations.clear();
  }

  private parseAmount(proposal: AgentProposal): bigint | PolicyEvalResult {
    const amount = proposal.intent.amount;
    if (amount === undefined || amount === null) return 0n;
    try {
      const value = BigInt(amount);
      if (value < 0n) return { outcome: 'rejected', reason: `Negative amount: ${amount}` };
      return value;
    } catch {
      return { outcome: 'rejected', reason: `Invalid amount: ${amount}` };
    }
  }

  async evaluate(proposal: AgentProposal, now = Date.now()): Promise<PolicyEvalResult> {
    const parsed = this.parseAmount(proposal);
    if (typeof parsed !== 'bigint') return parsed;
    if (proposal.intent.amount === undefined || proposal.intent.amount === null) {
      return { outcome: 'approved', reason: 'No amount to cap' };
    }

    if (this.perTx !== null && parsed > this.perTx) {
      return {
        outcome: 'rejected',
        reason: `Amount ${proposal.intent.amount} exceeds per-transaction cap of ${this.perTx.toString()}`,
      };
    }

    const { committed, reservedTotal } = this.windowUsage(this.keyFor(proposal), now);
    if (this.perDay !== null && committed + reservedTotal + parsed > this.perDay) {
      return {
        outcome: 'rejected',
        reason: `Daily total ${(committed + reservedTotal + parsed).toString()} exceeds per-day cap of ${this.perDay.toString()}`,
      };
    }

    return { outcome: 'approved', reason: 'Amount within caps' };
  }

  async reserve(proposal: AgentProposal, now = Date.now()): Promise<PolicyEvalResult> {
    const key = this.keyFor(proposal);
    const digest = proposalPolicyDigest(proposal);
    const existing = this.operations.get(proposal.id);

    if (existing) {
      if (existing.digest !== digest) {
        return { outcome: 'rejected', reason: 'operation ID is already bound to different proposal contents' };
      }
      if (existing.key !== key) {
        return { outcome: 'rejected', reason: 'operation ID is already bound to another policy scope' };
      }
      if (existing.status === 'reserved' || existing.status === 'committed') {
        return {
          outcome: 'approved',
          reason: 'Amount cap reservation already exists',
          reservationState: existing.status === 'committed' ? 'already_committed' : 'already_reserved',
        };
      }
    }

    const parsed = this.parseAmount(proposal);
    if (typeof parsed !== 'bigint') return parsed;
    if (proposal.intent.amount === undefined || proposal.intent.amount === null) {
      return { outcome: 'approved', reason: 'No amount to cap' };
    }

    if (this.perTx !== null && parsed > this.perTx) {
      return {
        outcome: 'rejected',
        reason: `Amount ${proposal.intent.amount} exceeds per-transaction cap of ${this.perTx.toString()}`,
      };
    }

    this.rollover(key, now);
    const { committed, reservedTotal } = this.windowUsage(key, now);
    if (this.perDay !== null && committed + reservedTotal + parsed > this.perDay) {
      return {
        outcome: 'rejected',
        reason: `Daily total ${(committed + reservedTotal + parsed).toString()} exceeds per-day cap of ${this.perDay.toString()}`,
      };
    }

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { dayStart: now, committed: 0n, reservations: new Map() };
      this.buckets.set(key, bucket);
    }
    bucket.reservations.set(proposal.id, parsed);
    this.operations.set(proposal.id, { key, amount: parsed, digest, status: 'reserved' });
    return { outcome: 'approved', reason: 'Amount cap reserved', reservationState: 'new' };
  }

  async commit(operationId: string): Promise<void> {
    const operation = this.operations.get(operationId);
    if (!operation || operation.status !== 'reserved') return;
    const bucket = this.buckets.get(operation.key);
    if (!bucket || !bucket.reservations.delete(operationId)) {
      operation.status = 'released';
      return;
    }
    bucket.committed += operation.amount;
    operation.status = 'committed';
  }

  /**
   * Release a reservation. Monotonic: only `reserved → released` is allowed;
   * releasing a `committed` operation is a no-op so committed quota can never
   * be recycled by a later reservation under the same operation ID.
   */
  async release(operationId: string): Promise<void> {
    const operation = this.operations.get(operationId);
    if (!operation || operation.status !== 'reserved') return;
    this.buckets.get(operation.key)?.reservations.delete(operationId);
    operation.status = 'released';
  }

  async reset(): Promise<void> {
    this.buckets.clear();
    this.operations.clear();
  }
}
