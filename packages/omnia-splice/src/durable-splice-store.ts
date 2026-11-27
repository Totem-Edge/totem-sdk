/**
 * Durable splice-state store (RFC-007 G9).
 *
 * A splice is a two-party (or multi-party) op that spans propose → quiesce →
 * accept → broadcast → finalize. If the host dies between "proposer signed
 * `SpliceProposal`" and "acceptor co-signed `SpliceAcceptance`", the pending
 * proposal — and the partial acceptance once made — must survive a restart so
 * the partial splice commit is recoverable/reconcilable (never silently
 * discarded or re-proposed with a fresh key slot).
 *
 * The store keeps one record per spliceId holding the proposal plus (once
 * received) the acceptance. Backed by the shared revision-CAS snapshot store:
 * corruption is surfaced (never treated as absence), no silent downgrade, and
 * concurrent propose/accept transitions across splices are never lost.
 */

import {
  createRevisionedSnapshotStore,
  type RevisionedSnapshotStore,
} from '@totemsdk/storage/snapshot';
import type { StorageAdapterWithCapabilities, CasStore, WriteAckMode } from '@totemsdk/storage/types';
import { StorageError } from '@totemsdk/storage/errors';
import type { SpliceProposal, SpliceAcceptance } from './types.js';

const DEFAULT_NAMESPACE = 'totem_omnia_splice:v1:';

export type SpliceRecordStatus = 'pending' | 'accepted' | 'finalized';

/** One in-progress splice: proposal persisted first, acceptance added later. */
export interface SpliceRecord {
  spliceId: string;
  channelId: string;
  proposal: SpliceProposal;
  acceptance?: SpliceAcceptance;
  status: SpliceRecordStatus;
  updatedAt: number;
}

export interface SpliceStoreState {
  /** spliceId → splice record. */
  splices: Record<string, SpliceRecord>;
}

export interface DurableSpliceStoreOptions {
  /** Key namespace prefix; default `totem_omnia_splice:v1:`. */
  readonly namespace?: string;
  /**
   * Required write acknowledgment; default `durably-acknowledged`. Pass
   * `volatile` only for tests/scratch adapters (e.g. `MemoryStore`).
   */
  readonly requireAckMode?: WriteAckMode;
}

export interface DurableSpliceStore {
  /** Persist a freshly created splice proposal (pending, pre-acceptance). */
  saveProposal(proposal: SpliceProposal): Promise<void>;
  /** Attach an acceptance; updates status to `accepted`. */
  saveAcceptance(acceptance: SpliceAcceptance): Promise<void>;
  /** Retrieve a splice record by spliceId. */
  getSplice(spliceId: string): Promise<SpliceRecord | undefined>;
  /** All records, optionally filtered by channel. */
  listSplices(channelId?: string): Promise<SpliceRecord[]>;
  /** Pending (proposed but not yet accepted) splices — reconcilable after restart. */
  listPending(): Promise<SpliceRecord[]>;
  /** Mark a splice finalized (splice TX confirmed on-chain). */
  markFinalized(spliceId: string): Promise<void>;
  getRevision(): Promise<number>;
  hasState(): Promise<boolean>;
  getSnapshot(): Promise<SpliceStoreState>;
}

function assertSpliceState(state: SpliceStoreState): void {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    throw new StorageError('omnia-splice store state is not an object', 'corrupt');
  }
  const value = (state as unknown as Record<string, unknown>).splices;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new StorageError('omnia-splice store state is missing section "splices"', 'corrupt');
  }
}

/** OMN-116: two acceptances are the same when they bind the same signer and signature. */
function sameAcceptance(a: SpliceAcceptance, b: SpliceAcceptance): boolean {
  return a.acceptorPublicKeyDigest === b.acceptorPublicKeyDigest
    && a.channelId === b.channelId
    && a.acceptorSignature === b.acceptorSignature;
}

export function createDurableSpliceStore(
  adapter: StorageAdapterWithCapabilities & CasStore,
  options: DurableSpliceStoreOptions = {},
): DurableSpliceStore {
  const snapshots: RevisionedSnapshotStore<SpliceStoreState> = createRevisionedSnapshotStore(
    adapter,
    {
      namespace: options.namespace ?? DEFAULT_NAMESPACE,
      requireAckMode: options.requireAckMode,
      empty: (): SpliceStoreState => ({ splices: {} }),
      validate: assertSpliceState,
    },
  );

  async function mutate(fn: (state: SpliceStoreState) => SpliceStoreState): Promise<void> {
    await snapshots.mutate(fn);
  }

  return {
    async saveProposal(proposal: SpliceProposal): Promise<void> {
      await mutate((state) => {
        const existing = state.splices[proposal.spliceId];
        // A duplicate proposal for the same spliceId never overrides the first.
        if (existing) return state;
        return {
          ...state,
          splices: {
            ...state.splices,
            [proposal.spliceId]: {
              spliceId: proposal.spliceId,
              channelId: proposal.channelId,
              proposal,
              status: 'pending',
              updatedAt: Date.now(),
            },
          },
        };
      });
    },

    async saveAcceptance(acceptance: SpliceAcceptance): Promise<void> {
      await mutate((state) => {
        const existing = state.splices[acceptance.spliceId];
        if (!existing) {
          throw new StorageError(
            `acceptance for unknown splice ${acceptance.spliceId}`,
            'write-failed',
            { key: acceptance.spliceId },
          );
        }
        // OMN-116: accepted → finalized is the only forward path. A replayed or
        // delayed acceptance may not regress a finalized record, and a second,
        // different acceptance for the same splice is a conflict.
        if (existing.status === 'finalized') {
          throw new StorageError(
            `splice ${acceptance.spliceId} is already finalized; acceptance cannot regress it`,
            'write-failed',
            { key: acceptance.spliceId },
          );
        }
        if (existing.acceptance) {
          if (sameAcceptance(existing.acceptance, acceptance)) return state;
          throw new StorageError(
            `conflicting acceptance for splice ${acceptance.spliceId}`,
            'write-failed',
            { key: acceptance.spliceId },
          );
        }
        return {
          ...state,
          splices: {
            ...state.splices,
            [acceptance.spliceId]: {
              ...existing,
              acceptance,
              status: 'accepted',
              updatedAt: Date.now(),
            },
          },
        };
      });
    },

    async getSplice(spliceId: string): Promise<SpliceRecord | undefined> {
      return (await snapshots.load()).splices[spliceId];
    },

    async listSplices(channelId?: string): Promise<SpliceRecord[]> {
      const state = await snapshots.load();
      const all = Object.values(state.splices);
      if (channelId === undefined) return all;
      return all.filter((s) => s.channelId === channelId);
    },

    async listPending(): Promise<SpliceRecord[]> {
      const state = await snapshots.load();
      return Object.values(state.splices).filter((s) => s.status === 'pending');
    },

    async markFinalized(spliceId: string): Promise<void> {
      await mutate((state) => {
        const existing = state.splices[spliceId];
        if (!existing) return state;
        // OMN-116: only an accepted splice may finalize; finalizing twice is an
        // idempotent no-op and a pending splice is a caller error.
        if (existing.status === 'finalized') return state;
        if (existing.status !== 'accepted' || !existing.acceptance) {
          throw new StorageError(
            `splice ${spliceId} cannot finalize before it is accepted`,
            'write-failed',
            { key: spliceId },
          );
        }
        return {
          ...state,
          splices: {
            ...state.splices,
            [spliceId]: { ...existing, status: 'finalized', updatedAt: Date.now() },
          },
        };
      });
    },

    getRevision: () => snapshots.getRevision(),
    hasState: () => snapshots.hasState(),
    async getSnapshot(): Promise<SpliceStoreState> {
      return snapshots.load();
    },
  };
}