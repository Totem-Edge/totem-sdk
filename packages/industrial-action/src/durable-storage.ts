/**
 * Durable `ActionStorage` (RFC-007 G6).
 *
 * The `ActionStorage` port was interface-only with no implementation. This is
 * a storage-backed backend: all proposals/executions/receipts live in a single
 * revision-CAS snapshot record, so writes are never lost under concurrency,
 * re-open restores the full action history, and corruption is surfaced — never
 * treated as absence.
 */

import {
  createRevisionedSnapshotStore,
  type RevisionedSnapshotStore,
} from '@totemsdk/storage/snapshot';
import type { StorageAdapterWithCapabilities, CasStore, WriteAckMode } from '@totemsdk/storage/types';
import { StorageError } from '@totemsdk/storage/errors';
import type { EdgeOperationResult } from '@totemsdk/edge';
import type {
  ActionProposal,
  ActionExecution,
  ActionReceipt,
  ActionStorage,
} from './types.js';

const DEFAULT_NAMESPACE = 'totem_action:v1:';

export interface ActionRegistryState {
  proposals: Record<string, ActionProposal>;
  executions: Record<string, ActionExecution>;
  receipts: Record<string, ActionReceipt>;
}

export interface DurableActionStorageOptions {
  /** Key namespace prefix; default `totem_action:v1:`. */
  readonly namespace?: string;
  /**
   * Required write acknowledgment; default `durably-acknowledged`. Pass
   * `volatile` only for tests/scratch adapters (e.g. `MemoryStore`).
   */
  readonly requireAckMode?: WriteAckMode;
}

export interface DurableActionStorage extends ActionStorage {
  getReceipt(receiptId: string): Promise<EdgeOperationResult<ActionReceipt>>;
  /** Current registry transition counter (0 before the first write). */
  getRevision(): Promise<number>;
  /** True once any snapshot record has been persisted. */
  hasState(): Promise<boolean>;
  /** Current persisted snapshot state. */
  getSnapshot(): Promise<ActionRegistryState>;
}

export function createDurableActionStorage(
  adapter: StorageAdapterWithCapabilities & CasStore,
  options: DurableActionStorageOptions = {},
): DurableActionStorage {
  const snapshots: RevisionedSnapshotStore<ActionRegistryState> = createRevisionedSnapshotStore(
    adapter,
    {
      namespace: options.namespace ?? DEFAULT_NAMESPACE,
      requireAckMode: options.requireAckMode,
      empty: (): ActionRegistryState => ({ proposals: {}, executions: {}, receipts: {} }),
      validate: assertRegistryState,
    },
  );

  async function mutate(
    fn: (state: ActionRegistryState) => ActionRegistryState,
  ): Promise<void> {
    await snapshots.mutate(fn);
  }

  return {
    async saveProposal(proposal: ActionProposal): Promise<EdgeOperationResult<void>> {
      await mutate((state) => {
        const proposals = { ...state.proposals, [proposal.id]: proposal };
        return { ...state, proposals };
      });
      return { ok: true };
    },

    async getProposal(id: string): Promise<EdgeOperationResult<ActionProposal>> {
      const state: ActionRegistryState = await snapshots.load();
      const proposal = state.proposals[id];
      if (!proposal) return { ok: false, error: `no action proposal found for '${id}'`, errorCode: 'not-found' };
      return { ok: true, data: proposal };
    },

    async saveExecution(execution: ActionExecution): Promise<EdgeOperationResult<void>> {
      await mutate((state) => {
        const executions = { ...state.executions, [execution.id]: execution };
        return { ...state, executions };
      });
      return { ok: true };
    },

    async getExecution(id: string): Promise<EdgeOperationResult<ActionExecution>> {
      const state: ActionRegistryState = await snapshots.load();
      const execution = state.executions[id];
      if (!execution) return { ok: false, error: `no action execution found for '${id}'`, errorCode: 'not-found' };
      return { ok: true, data: execution };
    },

    async saveReceipt(receipt: ActionReceipt): Promise<EdgeOperationResult<void>> {
      await mutate((state) => {
        const receipts = { ...state.receipts, [receipt.receiptId]: receipt };
        return { ...state, receipts };
      });
      return { ok: true };
    },

    async getReceipt(receiptId: string): Promise<EdgeOperationResult<ActionReceipt>> {
      const state: ActionRegistryState = await snapshots.load();
      const receipt = state.receipts[receiptId];
      if (!receipt) return { ok: false, error: `no action receipt found for '${receiptId}'`, errorCode: 'not-found' };
      return { ok: true, data: receipt };
    },

    getRevision: () => snapshots.getRevision(),
    hasState: () => snapshots.hasState(),
    async getSnapshot(): Promise<ActionRegistryState> {
      return snapshots.load();
    },
  };
}

function assertRegistryState(state: ActionRegistryState): void {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    throw new StorageError('action registry state is not an object', 'corrupt');
  }
  for (const section of ['proposals', 'executions', 'receipts'] as const) {
    const value = (state as unknown as Record<string, unknown>)[section];
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new StorageError(`action registry state is missing section "${section}"`, 'corrupt');
    }
  }
}