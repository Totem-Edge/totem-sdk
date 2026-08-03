import type { AgentProposal, PolicyEvalResult, PolicyMiddleware } from './types.js';

/**
 * AmountCapPolicy — caps the total amount of MIN or tokens an agent can
 * spend per transaction and/or per day.
 *
 * Amounts are compared as BigInt. Only proposals with a numeric `amount`
 * are subject to caps — proposals without an amount pass through.
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
  /** Maximum total amount per rolling 24-hour window. */
  perDay?: string;
}

export class AmountCapPolicy implements PolicyMiddleware {
  private readonly perTx: bigint | null;
  private readonly perDay: bigint | null;
  private dayTotal: bigint = 0n;
  private dayStart: number = 0;

  constructor(config: AmountCapConfig) {
    this.perTx = config.perTx !== undefined ? BigInt(config.perTx) : null;
    this.perDay = config.perDay !== undefined ? BigInt(config.perDay) : null;
  }

  async evaluate(proposal: AgentProposal, now = Date.now()): Promise<PolicyEvalResult> {
    const amount = proposal.intent.amount;
    if (amount === undefined || amount === null) {
      return { outcome: 'approved', reason: 'No amount to cap' };
    }
    let value: bigint;
    try {
      value = BigInt(amount);
    } catch {
      return { outcome: 'rejected', reason: `Invalid amount: ${amount}` };
    }
    if (value < 0n) {
      return { outcome: 'rejected', reason: `Negative amount: ${amount}` };
    }

    if (this.perTx !== null && value > this.perTx) {
      return {
        outcome: 'rejected',
        reason: `Amount ${amount} exceeds per-transaction cap of ${this.perTx.toString()}`,
      };
    }

    if (now - this.dayStart >= 86_400_000) {
      this.dayTotal = 0n;
      this.dayStart = now;
    }

    if (this.perDay !== null && this.dayTotal + value > this.perDay) {
      return {
        outcome: 'rejected',
        reason: `Daily total ${(this.dayTotal + value).toString()} exceeds per-day cap of ${this.perDay.toString()}`,
      };
    }

    this.dayTotal += value;
    return { outcome: 'approved', reason: 'Amount within caps' };
  }

  async reset(): Promise<void> {
    this.dayTotal = 0n;
    this.dayStart = 0;
  }
}
