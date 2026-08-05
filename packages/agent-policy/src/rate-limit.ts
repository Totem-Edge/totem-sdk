import type { AgentProposal, PolicyEvalResult, PolicyMiddleware } from './types.js';

/**
 * RateLimitPolicy — limits the number of committed proposals within a
 * fixed time window. Reservations hold quota until committed or released.
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
  private readonly buckets = new Map<string, {
    windowStart: number;
    committed: number;
    reservations: Set<string>;
  }>();
  private readonly operations = new Map<string, {
    key: string;
    status: 'reserved' | 'committed' | 'released';
  }>();

  constructor(maxProposals: number, windowMs: number) {
    if (maxProposals < 1) throw new Error('maxProposals must be >= 1');
    if (windowMs < 1) throw new Error('windowMs must be >= 1');
    this.maxProposals = maxProposals;
    this.windowMs = windowMs;
  }

  private keyFor(proposal: AgentProposal): string {
    return `${proposal.agentId}\u0000${proposal.intent.tokenId ?? 'native'}`;
  }

  private bucketFor(key: string, now: number) {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { windowStart: now, committed: 0, reservations: new Set() };
      this.buckets.set(key, bucket);
      return bucket;
    }
    if (now - bucket.windowStart >= this.windowMs) {
      for (const operationId of bucket.reservations) {
        this.operations.set(operationId, { key, status: 'released' });
      }
      bucket.windowStart = now;
      bucket.committed = 0;
      bucket.reservations.clear();
    }
    return bucket;
  }

  private evaluateKey(key: string, now: number): PolicyEvalResult {
    const bucket = this.bucketFor(key, now);
    if (bucket.committed + bucket.reservations.size >= this.maxProposals) {
      const waitMs = Math.max(0, this.windowMs - (now - bucket.windowStart));
      return {
        outcome: 'rejected',
        reason: `Rate limit exceeded: ${this.maxProposals} per ${this.windowMs}ms window. Retry in ${waitMs}ms`,
      };
    }
    return { outcome: 'approved', reason: 'Rate limit OK' };
  }

  async evaluate(proposal: AgentProposal, now = Date.now()): Promise<PolicyEvalResult> {
    return this.evaluateKey(this.keyFor(proposal), now);
  }

  async reserve(proposal: AgentProposal, now = Date.now()): Promise<PolicyEvalResult> {
    const key = this.keyFor(proposal);
    const existing = this.operations.get(proposal.id);
    if (existing && existing.key !== key) {
      return { outcome: 'rejected', reason: 'operation ID is already bound to another policy scope' };
    }
    if (existing?.status === 'reserved' || existing?.status === 'committed') {
      return { outcome: 'approved', reason: 'Rate limit reservation already exists' };
    }

    const result = this.evaluateKey(key, now);
    if (result.outcome !== 'approved') return result;
    const bucket = this.bucketFor(key, now);
    bucket.reservations.add(proposal.id);
    this.operations.set(proposal.id, { key, status: 'reserved' });
    return { outcome: 'approved', reason: 'Rate limit reserved' };
  }

  async commit(operationId: string): Promise<void> {
    const operation = this.operations.get(operationId);
    if (!operation || operation.status === 'committed' || operation.status === 'released') return;
    const bucket = this.buckets.get(operation.key);
    if (!bucket || !bucket.reservations.delete(operationId)) {
      operation.status = 'released';
      return;
    }
    bucket.committed++;
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
