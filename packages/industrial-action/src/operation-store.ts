/**
 * RFC-010 §6.6 — durable device-operation records.
 *
 * Edge's `stepId`/`nonce` replay-protect *authorization*; they do not give
 * device actuation an at-most-once guarantee. This store persists a record per
 * deterministic `operationId` (see `computeOperationId`) over the shared
 * `@totemsdk/storage` revision-CAS snapshot, so a re-submitted or retried
 * action resolves to the same record, concurrent double-submits are serialized,
 * and the outcome survives restart.
 */

import {
  createRevisionedSnapshotStore,
  type RevisionedSnapshotStore,
} from '@totemsdk/storage/snapshot';
import type { StorageAdapterWithCapabilities, CasStore, WriteAckMode } from '@totemsdk/storage/types';
import { StorageError } from '@totemsdk/storage/errors';
import type { ActionOutcome } from './edge-adapter.js';

const DEFAULT_NAMESPACE = 'totem_industrial_action:v1:';

/** `in-flight` plus every terminal outcome. */
export type OperationStatus = 'in-flight' | ActionOutcome;

export interface DeviceOperationRecord {
  operationId: string;
  proposalId?: string;
  status: OperationStatus;
  attempts: number;
  outcome?: ActionOutcome;
  updatedAt: number;
  result?: unknown;
}

export interface OperationClaim {
  /** True when this caller created the in-flight record (owns actuation). */
  claimed: boolean;
  record: DeviceOperationRecord;
}

export interface DeviceOperationStore {
  /**
   * Atomically claim an operation. Returns the existing record when one is
   * already present (terminal or in-flight); otherwise creates an `in-flight`
   * record and returns `claimed: true`.
   */
  claimOperation(operationId: string, proposalId: string | undefined, now: number): Promise<OperationClaim>;
  /** Replace a record (typically transitioning it out of `in-flight`). */
  transitionOperation(next: DeviceOperationRecord): Promise<boolean>;
  getOperation(operationId: string): Promise<DeviceOperationRecord | undefined>;
}

export interface DurableDeviceOperationStoreOptions {
  readonly namespace?: string;
  readonly requireAckMode?: WriteAckMode;
}

interface OperationState {
  operations: Record<string, DeviceOperationRecord>;
}

export function createDurableDeviceOperationStore(
  adapter: StorageAdapterWithCapabilities & CasStore,
  options: DurableDeviceOperationStoreOptions = {},
): DeviceOperationStore {
  const snapshots: RevisionedSnapshotStore<OperationState> = createRevisionedSnapshotStore(adapter, {
    namespace: options.namespace ?? DEFAULT_NAMESPACE,
    requireAckMode: options.requireAckMode,
    empty: (): OperationState => ({ operations: {} }),
    validate: assertOperationState,
  });

  return {
    async claimOperation(operationId, proposalId, now) {
      let claim: OperationClaim | undefined;
      await snapshots.mutate((state) => {
        const existing = state.operations[operationId];
        if (existing) {
          claim = { claimed: false, record: existing };
          return state;
        }
        const record: DeviceOperationRecord = {
          operationId,
          ...(proposalId !== undefined ? { proposalId } : {}),
          status: 'in-flight',
          attempts: 0,
          updatedAt: now,
        };
        claim = { claimed: true, record };
        return { ...state, operations: { ...state.operations, [operationId]: record } };
      });
      // `mutate` always runs the callback, so `claim` is assigned.
      return claim as OperationClaim;
    },

    async transitionOperation(next) {
      let transitioned = false;
      await snapshots.mutate((state) => {
        if (!state.operations[next.operationId]) return state;
        transitioned = true;
        return { ...state, operations: { ...state.operations, [next.operationId]: next } };
      });
      return transitioned;
    },

    async getOperation(operationId) {
      const state: OperationState = await snapshots.load();
      return state.operations[operationId];
    },
  };
}

function assertOperationState(state: OperationState): void {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    throw new StorageError('device-operation state is not an object', 'corrupt');
  }
  const value = (state as unknown as Record<string, unknown>).operations;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new StorageError('device-operation state is missing section "operations"', 'corrupt');
  }
}
