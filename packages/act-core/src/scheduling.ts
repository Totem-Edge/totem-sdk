/**
 * RFC-011 §4.8 — scheduling: maintenance windows and rate limits.
 *
 * Actions may be constrained to maintenance windows (outside → reject) and
 * rate-limited per resource/epoch to protect devices from oscillatory control.
 * Windows are evaluated against an injectable clock; the rate limiter is durable
 * (revision-CAS) so limits survive restart.
 */

import {
  createRevisionedSnapshotStore,
  type RevisionedSnapshotStore,
} from '@totemsdk/storage/snapshot';
import type { StorageAdapterWithCapabilities, CasStore, WriteAckMode } from '@totemsdk/storage/types';
import { StorageError } from '@totemsdk/storage/errors';

const DEFAULT_NAMESPACE = 'totem_industrial_ratelimit:v1:';

/** Absolute half-open interval `[start, end)` in epoch milliseconds. */
export interface TimeWindow {
  start: number;
  end: number;
}

export interface RateLimit {
  /** Max actuations permitted per `windowMs`. */
  maxActuations: number;
  windowMs: number;
}

export interface ActionSchedule {
  /** Allowed execution windows; omitted = always allowed. */
  windows?: TimeWindow[];
  rateLimit?: RateLimit;
}

export interface WindowCheck {
  allowed: boolean;
  /** Next window start when not currently allowed. */
  nextOpen?: number;
}

export function isWithinWindows(windows: TimeWindow[], now: number): WindowCheck {
  for (const w of windows) {
    if (now >= w.start && now < w.end) return { allowed: true };
  }
  const upcoming = windows
    .map((w) => w.start)
    .filter((start) => start > now)
    .sort((a, b) => a - b)[0];
  return { allowed: false, ...(upcoming !== undefined ? { nextOpen: upcoming } : {}) };
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimiter {
  consume(key: string, limit: RateLimit): Promise<RateLimitResult>;
  peek(key: string, limit: RateLimit): Promise<RateLimitResult>;
}

export interface DurableRateLimiterOptions {
  readonly namespace?: string;
  readonly requireAckMode?: WriteAckMode;
  readonly now?: () => number;
}

interface Bucket {
  count: number;
  windowStart: number;
}

interface RateLimitState {
  buckets: Record<string, Bucket>;
}

export function createDurableRateLimiter(
  adapter: StorageAdapterWithCapabilities & CasStore,
  options: DurableRateLimiterOptions = {},
): RateLimiter {
  const now = options.now ?? (() => Date.now());
  const snapshots: RevisionedSnapshotStore<RateLimitState> = createRevisionedSnapshotStore(adapter, {
    namespace: options.namespace ?? DEFAULT_NAMESPACE,
    requireAckMode: options.requireAckMode,
    empty: (): RateLimitState => ({ buckets: {} }),
    validate: assertRateLimitState,
  });

  function evaluate(bucket: Bucket | undefined, limit: RateLimit, at: number): { bucket: Bucket; result: RateLimitResult } {
    const current = bucket && at - bucket.windowStart < limit.windowMs ? bucket : { count: 0, windowStart: at };
    const remaining = Math.max(0, limit.maxActuations - current.count);
    return { bucket: current, result: { allowed: remaining > 0, remaining, resetAt: current.windowStart + limit.windowMs } };
  }

  return {
    async consume(key, limit) {
      const at = now();
      let out: RateLimitResult = { allowed: false, remaining: 0, resetAt: at };
      await snapshots.mutate((state) => {
        const { bucket, result } = evaluate(state.buckets[key], limit, at);
        out = result;
        if (!result.allowed) return state;
        const next: Bucket = { count: bucket.count + 1, windowStart: bucket.windowStart };
        return { ...state, buckets: { ...state.buckets, [key]: next } };
      });
      return out;
    },
    async peek(key, limit) {
      const state: RateLimitState = await snapshots.load();
      return evaluate(state.buckets[key], limit, now()).result;
    },
  };
}

function assertRateLimitState(state: RateLimitState): void {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    throw new StorageError('rate-limit state is not an object', 'corrupt');
  }
  const value = (state as unknown as Record<string, unknown>).buckets;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new StorageError('rate-limit state is missing section "buckets"', 'corrupt');
  }
}
