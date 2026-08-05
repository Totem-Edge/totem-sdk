import type { AgentProposal, PolicyEvalResult, PolicyMiddleware } from './types.js';

/**
 * AmountCapPolicy — caps the total amount of MIN or tokens an agent can
 * spend per transaction and/or per day.
 *
 * Amounts are compared as BigInt. Only proposals with a numeric `amount`
 * are subject to caps — proposals without an amount pass through.
 *
 * The daily cap uses a fixed 24-hour window per agent and token.
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

export class AmountCapPolicy implements PolicyMiddleware {
  private readonly perTx: bigint | null;
  private readonly perDay: bigint | null;
  private readonly buckets = new Map<string, {
    dayStart: number;
    committed: bigint;
    reservations: Map<string, bigint>;
  }>();
  private readonly operations = new Map<string, {
    key: string;
    amount: bigint;
    status: 'reserved' | 'committed' | 'released';
  }>();

  constructor(config: AmountCapConfig) {
    this.perTx = config.perTx !== undefined ? BigInt(config.perTx) : null;
    this.perDay = config.perDay !== undefined ? BigInt(config.perDay) : null;
    if (this.perTx !== null && this.perTx < 0n) throw new Error('perTx must be non-negative');
    if (this.perDay !== null && this.perDay < 0n) throw new Error('perDay must be non-negative');
  }

  private keyFor(proposal: AgentProposal): string {
    return `${proposal.agentId}\u0000${proposal.intent.tokenId ?? 'native'}`;
  }

  private bucketFor(key: string, now: number) {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { dayStart: now, committed: 0n, reservations: new Map() };
      this.buckets.set(key, bucket);
      return bucket;
    }
    if (now - bucket.dayStart >= 86_400_000) {
      for (const operationId of bucket.reservations.keys()) {
        this.operations.set(operationId, { key, amount: 0n, status: 'released' });
      }
      bucket.dayStart = now;
      bucket.committed = 0n;
      bucket.reservations.clear();
    }
    return bucket;
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

  private evaluateSync(proposal: AgentProposal, now: number): PolicyEvalResult {
    const parsed = this.parseAmount(proposal);
    if (typeof parsed !== 'bigint') return parsed;
    const amount = proposal.intent.amount;
    if (amount === undefined || amount === null) {
      return { outcome: 'approved', reason: 'No amount to cap' };
    }

    if (this.perTx !== null && parsed > this.perTx) {
      return {
        outcome: 'rejected',
        reason: `Amount ${amount} exceeds per-transaction cap of ${this.perTx.toString()}`,
      };
    }

    const bucket = this.bucketFor(this.keyFor(proposal), now);
    const reservedTotal = [...bucket.reservations.values()].reduce((sum, value) => sum + value, 0n);
    if (this.perDay !== null && bucket.committed + reservedTotal + parsed > this.perDay) {
      return {
        outcome: 'rejected',
        reason: `Daily total ${(bucket.committed + reservedTotal + parsed).toString()} exceeds per-day cap of ${this.perDay.toString()}`,
      };
    }

    return { outcome: 'approved', reason: 'Amount within caps' };
  }

  async evaluate(proposal: AgentProposal, now = Date.now()): Promise<PolicyEvalResult> {
    return this.evaluateSync(proposal, now);
  }

  async reserve(proposal: AgentProposal, now = Date.now()): Promise<PolicyEvalResult> {
    const key = this.keyFor(proposal);
    const existing = this.operations.get(proposal.id);
    if (existing && existing.key !== key) {
      return { outcome: 'rejected', reason: 'operation ID is already bound to another policy scope' };
    }
    if (existing?.status === 'reserved' || existing?.status === 'committed') {
      return { outcome: 'approved', reason: 'Amount cap reservation already exists' };
    }

    const parsed = this.parseAmount(proposal);
    if (typeof parsed !== 'bigint') return parsed;
    const result = this.evaluateSync(proposal, now);
    if (result.outcome !== 'approved') return result;
    if (proposal.intent.amount === undefined || proposal.intent.amount === null) return result;

    this.bucketFor(key, now).reservations.set(proposal.id, parsed);
    this.operations.set(proposal.id, { key, amount: parsed, status: 'reserved' });
    return { outcome: 'approved', reason: 'Amount cap reserved' };
  }

  async commit(operationId: string): Promise<void> {
    const operation = this.operations.get(operationId);
    if (!operation || operation.status === 'committed' || operation.status === 'released') return;
    const bucket = this.buckets.get(operation.key);
    if (!bucket || !bucket.reservations.delete(operationId)) {
      operation.status = 'released';
      return;
    }
    bucket.committed += operation.amount;
    operation.status = 'committed';
  }

  async release(operationId: string): Promise<void> {
    const operation = this.operations.get(operationId);
    if (!operation || operation.status === 'released') return;
    if (operation.status === 'reserved') {
      this.buckets.get(operation.key)?.reservations.delete(operationId);
    }
    operation.status = 'released';
  }

  async reset(): Promise<void> {
    this.buckets.clear();
    this.operations.clear();
  }
}
