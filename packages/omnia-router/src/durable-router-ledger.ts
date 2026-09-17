/**
 * Durable settled-segment ledger (RFC-007 G9).
 *
 * Payment execution is multi-channel: a route spans several HTLC hops, each
 * fulfilled in reverse order by revealing the preimage. If the host dies
 * mid-route (after some hops settled, before others), the already-settled
 * segments — channel + HTLC + revealed preimage + settled-at — must survive a
 * restart so the node can (a) never re-lock or re-settle an already-committed
 * segment, and (b) reconcile still-pending locks. This ledger records exactly
 * those settled segments, keyed `channelId:htlcId`, idempotently.
 *
 * Backed by the shared revision-CAS snapshot store: corruption is surfaced
 * (never treated as absence), no silent downgrade, and concurrent hop
 * settlement is never lost.
 */

import {
  createRevisionedSnapshotStore,
  type RevisionedSnapshotStore,
} from '@totemsdk/storage/snapshot';
import type { StorageAdapterWithCapabilities, CasStore, WriteAckMode } from '@totemsdk/storage/types';
import { StorageError } from '@totemsdk/storage/errors';

const DEFAULT_NAMESPACE = 'totem_omnia_router:v1:';

/** A payment segment that has been irrevocably settled by preimage reveal. */
export interface SettledSegment {
  channelId: string;
  htlcId: string;
  /** Preimage revealed during settlement — must survive a mid-route restart. */
  preimage: string;
  /** Monotonic settlement timestamp. */
  settledAt: number;
  /** Optional hop-level detail for reconciliation (amount, counterpart, digest). */
  tokenId?: string;
  senderPublicKeyDigest?: string;
  recipientPublicKeyDigest?: string;
  /** Set once a segment is fully reconciled against the node's route state. */
  reconciled?: boolean;
}

export interface RouterLedgerState {
  /** `channelId:htlcId` → settled segment. */
  segments: Record<string, SettledSegment>;
}

export interface DurableRouterLedgerOptions {
  /** Key namespace prefix; default `totem_omnia_router:v1:`. */
  readonly namespace?: string;
  /**
   * Required write acknowledgment; default `durably-acknowledged`. Pass
   * `volatile` only for tests/scratch adapters (e.g. `MemoryStore`).
   */
  readonly requireAckMode?: WriteAckMode;
}

export interface DurableRouterLedger {
  /** Idempotently record a settled segment. Re-recording the same segment is a no-op. */
  recordSettled(segment: SettledSegment): Promise<void>;
  /** True when the given channel+HTLC already settled. */
  isSettled(channelId: string, htlcId: string): Promise<boolean>;
  /** Retrieve a previously settled segment. */
  getSettled(channelId: string, htlcId: string): Promise<SettledSegment | undefined>;
  /** All settled segments, optionally filtered by channel. */
  listSettled(channelId?: string): Promise<SettledSegment[]>;
  /** Mark a settled segment as reconciled with the route state. */
  markReconciled(channelId: string, htlcId: string): Promise<void>;
  getRevision(): Promise<number>;
  hasState(): Promise<boolean>;
  getSnapshot(): Promise<RouterLedgerState>;
}

function segmentKey(channelId: string, htlcId: string): string {
  return `${channelId}:${htlcId}`;
}

function assertLedgerState(state: RouterLedgerState): void {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    throw new StorageError('omnia-router ledger state is not an object', 'corrupt');
  }
  const value = (state as unknown as Record<string, unknown>).segments;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new StorageError('omnia-router ledger state is missing section "segments"', 'corrupt');
  }
}

export function createDurableRouterLedger(
  adapter: StorageAdapterWithCapabilities & CasStore,
  options: DurableRouterLedgerOptions = {},
): DurableRouterLedger {
  const snapshots: RevisionedSnapshotStore<RouterLedgerState> = createRevisionedSnapshotStore(
    adapter,
    {
      namespace: options.namespace ?? DEFAULT_NAMESPACE,
      requireAckMode: options.requireAckMode,
      empty: (): RouterLedgerState => ({ segments: {} }),
      validate: assertLedgerState,
    },
  );

  async function mutate(fn: (state: RouterLedgerState) => RouterLedgerState): Promise<void> {
    await snapshots.mutate(fn);
  }

  async function loadSegment(channelId: string, htlcId: string): Promise<SettledSegment | undefined> {
    const state = await snapshots.load();
    return state.segments[segmentKey(channelId, htlcId)];
  }

  return {
    async recordSettled(segment: SettledSegment): Promise<void> {
      // Short-circuit already-recorded segments: re-recording is a no-op and
      // must not advance the revision or rewrite an immutable record.
      if (await loadSegment(segment.channelId, segment.htlcId)) return;
      await mutate((state) => {
        const key = segmentKey(segment.channelId, segment.htlcId);
        return { ...state, segments: { ...state.segments, [key]: segment } };
      });
    },

    isSettled(channelId: string, htlcId: string): Promise<boolean> {
      return loadSegment(channelId, htlcId).then((seg) => seg !== undefined);
    },

    getSettled: loadSegment,

    async listSettled(channelId?: string): Promise<SettledSegment[]> {
      const state = await snapshots.load();
      const all = Object.values(state.segments);
      if (channelId === undefined) return all;
      return all.filter((s) => s.channelId === channelId);
    },

    async markReconciled(channelId: string, htlcId: string): Promise<void> {
      await mutate((state) => {
        const key = segmentKey(channelId, htlcId);
        const existing = state.segments[key];
        if (!existing) return state;
        return {
          ...state,
          segments: { ...state.segments, [key]: { ...existing, reconciled: true } },
        };
      });
    },

    getRevision: () => snapshots.getRevision(),
    hasState: () => snapshots.hasState(),
    async getSnapshot(): Promise<RouterLedgerState> {
      return snapshots.load();
    },
  };
}