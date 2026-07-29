import type { AgentProposal, PolicyEvalResult, PolicyMiddleware } from './types.js';

/**
 * RateLimitPolicy — limits the number of approved proposals within a
 * sliding time window. Once the limit is exceeded, subsequent proposals
 * are rejected until the window rolls over.
 *
 * Uses a simple fixed-window counter (not token-bucket or sliding-log)
 * to keep memory and CPU overhead near zero on constrained edge devices.
 *
 * @example
 * ```ts
 * // Max 10 proposals per 60 seconds
 * const rateLimit = new RateLimitPolicy(10, 60_000);
 * ```
 */
export class RateLimitPolicy implements PolicyMiddleware {
  private readonly maxProposals: number;
  private readonly windowMs: number;
  private count: number = 0;
  private windowStart: number = 0;

  constructor(maxProposals: number, windowMs: number) {
    if (maxProposals < 1) throw new Error('maxProposals must be >= 1');
    if (windowMs < 1) throw new Error('windowMs must be >= 1');
    this.maxProposals = maxProposals;
    this.windowMs = windowMs;
  }

  async evaluate(proposal: AgentProposal): Promise<PolicyEvalResult> {
    const now = Date.now();
    if (now - this.windowStart >= this.windowMs) {
      this.count = 0;
      this.windowStart = now;
    }
    if (this.count >= this.maxProposals) {
      const waitMs = this.windowMs - (now - this.windowStart);
      return {
        outcome: 'rejected',
        reason: `Rate limit exceeded: ${this.maxProposals} per ${this.windowMs}ms window. Retry in ${waitMs}ms`,
      };
    }
    this.count++;
    return { outcome: 'approved', reason: 'Rate limit OK' };
  }

  async reset(): Promise<void> {
    this.count = 0;
    this.windowStart = 0;
  }
}
