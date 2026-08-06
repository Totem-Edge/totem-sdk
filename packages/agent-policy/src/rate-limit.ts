import type { AgentProposal, PolicyEvalResult, PolicyMiddleware } from './types.js';
import { proposalPolicyDigest } from './digest.js';

/**
 * RateLimitPolicy — limits the number of committed proposals within a
 * fixed time window. Reservations hold quota until committed or released.
 *
 * Uses a simple fixed-window counter (not token-bucket or sliding-log)
 * to keep memory and CPU overhead near zero on constrained edge devices.
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
 * // Max 10 proposals per 60 seconds
 * const rateLimit = new RateLimitPolicy(10, 60_000);
 * ```
 */
interface RateOperation {
  key: string;
  digest: string;
  status: 'reserved' | 'committed' | 'released';
}

export class RateLimitPolicy implements PolicyMiddleware {
  private readonly maxProposals: number;
  private readonly windowMs: number;
  private readonly buckets = new Map<string, {
    windowStart: number;
    committed: number;
    reservations: Set<string>;
  }>();
  private readonly operations = new Map<string, RateOperation>();

  constructor(maxProposals: number, windowMs: number) {
    if (maxProposals < 1) throw new Error('maxProposals must be >= 1');
    if (windowMs < 1) throw new Error('windowMs must be >= 1');
    this.maxProposals = maxProposals;
    this.windowMs = windowMs;
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
   * window rollover. Never mutates state — `evaluate()` must remain read-only.
   */
  private windowUsage(key: string, now: number): { committed: number; reserved: number } {
    const bucket = this.buckets.get(key);
    if (!bucket) return { committed: 0, reserved: 0 };
    if (now - bucket.windowStart >= this.windowMs) return { committed: 0, reserved: 0 };
    return { committed: bucket.committed, reserved: bucket.reservations.size };
  }

  /**
   * Roll the window forward when it has elapsed, releasing stale
   * reservations. Only the mutating lifecycle paths call this.
   */
  private rollover(key: string, now: number): void {
    const bucket = this.buckets.get(key);
    if (!bucket || now - bucket.windowStart < this.windowMs) return;
    for (const operationId of bucket.reservations) {
      const operation = this.operations.get(operationId);
      if (operation) operation.status = 'released';
    }
    bucket.windowStart = now;
    bucket.committed = 0;
    bucket.reservations.clear();
  }

  private evaluateKey(key: string, now: number): PolicyEvalResult {
    const { committed, reserved } = this.windowUsage(key, now);
    if (committed + reserved >= this.maxProposals) {
      const bucket = this.buckets.get(key);
      const elapsed = bucket ? now - bucket.windowStart : 0;
      const waitMs = Math.max(0, this.windowMs - elapsed);
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
        return { outcome: 'approved', reason: 'Rate limit reservation already exists' };
      }
    }

    const result = this.evaluateKey(key, now);
    if (result.outcome !== 'approved') return result;

    this.rollover(key, now);
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { windowStart: now, committed: 0, reservations: new Set() };
      this.buckets.set(key, bucket);
    }
    bucket.reservations.add(proposal.id);
    this.operations.set(proposal.id, { key, digest, status: 'reserved' });
    return { outcome: 'approved', reason: 'Rate limit reserved' };
  }

  async commit(operationId: string): Promise<void> {
    const operation = this.operations.get(operationId);
    if (!operation || operation.status !== 'reserved') return;
    const bucket = this.buckets.get(operation.key);
    if (!bucket || !bucket.reservations.delete(operationId)) {
      operation.status = 'released';
      return;
    }
    bucket.committed++;
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
