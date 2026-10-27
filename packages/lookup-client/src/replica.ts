/**
 * RFC-057 Phase 4 — freshness-aware lookup reads.
 *
 * Wraps the authoritative LookupClient with an optional replicated read view.
 * Replica values are returned only with explicit freshness/complete flags; a
 * replica failure is surfaced, never silently replaced by a primary read.
 */

import type { ChainTip, Coin, CoinsQuery } from '@totemsdk/chain-provider';
import { readReplicated, type ReplicaObservation, type ReplicatedRead } from '@totemsdk/replication';
import type { LookupClient } from './client.js';

export interface LookupReplicaSource {
  get(key: string): Promise<ReplicaObservation<unknown> | null>;
}

export interface LookupReadReplicaOptions {
  /** Observations older than this are reported stale. */
  maxAgeMs?: number;
  now?: () => number;
}

export class LookupClientReadReplica {
  constructor(
    private readonly client: LookupClient,
    private readonly replica: LookupReplicaSource,
    private readonly options: LookupReadReplicaOptions = {},
  ) {}

  async getCoins(query: CoinsQuery): Promise<ReplicatedRead<Coin[]>> {
    return this.read<Coin[]>(`coins:${stableKey(query)}`, () => this.client.getCoins(query));
  }

  async getTip(): Promise<ReplicatedRead<ChainTip>> {
    return this.read<ChainTip>('chain-tip', () => this.client.getTip());
  }

  private async read<T>(key: string, primary: () => Promise<T>): Promise<ReplicatedRead<T>> {
    return readReplicated<T>(key, {
      readReplica: async (k) => {
        const observation = await this.replica.get(k);
        return observation ? { ...observation, value: observation.value as T | null } : null;
      },
      readPrimary: async () => primary(),
      ...(this.options.maxAgeMs !== undefined ? { maxAgeMs: this.options.maxAgeMs } : {}),
      ...(this.options.now ? { now: this.options.now } : {}),
    });
  }
}

function stableKey(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableKey).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableKey((value as Record<string, unknown>)[key])}`)
    .join(',')}}`;
}
