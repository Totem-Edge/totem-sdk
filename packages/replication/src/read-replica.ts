/**
 * RFC-057 Phase 4 — freshness-aware replicated reads.
 *
 * A replica never claims to be authoritative. `complete: false` or an expired
 * observation is surfaced as `stale`; a primary read is used only when the
 * replica has no value and a primary reader is explicitly supplied. Replica
 * errors are never silently converted into primary reads.
 */

export type ReplicaFreshness = 'fresh' | 'stale' | 'unknown';

export interface ReplicaObservation<T> {
  readonly value: T | null;
  readonly complete: boolean;
  readonly observedAt?: number;
}

export interface ReplicatedRead<T> {
  readonly value: T | null;
  readonly source: 'replica' | 'primary' | 'none';
  readonly freshness: ReplicaFreshness;
  readonly complete: boolean;
  readonly observedAt?: number;
}

export interface ReplicatedReadOptions<T> {
  readonly readReplica: (key: string) => Promise<ReplicaObservation<T> | null>;
  readonly readPrimary?: (key: string) => Promise<T | null>;
  readonly maxAgeMs?: number;
  readonly now?: () => number;
}

export async function readReplicated<T>(
  key: string,
  options: ReplicatedReadOptions<T>,
): Promise<ReplicatedRead<T>> {
  const observation = await options.readReplica(key);
  const now = options.now?.() ?? Date.now();

  if (observation && observation.value !== null) {
    const expired =
      options.maxAgeMs !== undefined &&
      (observation.observedAt === undefined || now - observation.observedAt > options.maxAgeMs);
    return {
      value: observation.value,
      source: 'replica',
      freshness: observation.complete && !expired ? 'fresh' : 'stale',
      complete: observation.complete && !expired,
      ...(observation.observedAt !== undefined ? { observedAt: observation.observedAt } : {}),
    };
  }

  if (!options.readPrimary) {
    return { value: null, source: 'none', freshness: 'unknown', complete: false };
  }

  const value = await options.readPrimary(key);
  return {
    value,
    source: 'primary',
    freshness: value === null ? 'unknown' : 'fresh',
    complete: value !== null,
  };
}
