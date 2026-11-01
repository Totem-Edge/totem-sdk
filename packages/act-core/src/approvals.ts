/**
 * RFC-011 §4.9 — approvals (human-in-the-loop).
 *
 * An approval is a first-class record bound to the action's commitment, so an
 * approval cannot be replayed onto a different action. Durable and expiring.
 */

import { hashCanonical } from '@totemsdk/core';
import {
  createRevisionedSnapshotStore,
  type RevisionedSnapshotStore,
} from '@totemsdk/storage/snapshot';
import type { StorageAdapterWithCapabilities, CasStore, WriteAckMode } from '@totemsdk/storage/types';
import { StorageError } from '@totemsdk/storage/errors';
import type { ResourceId } from './resources.js';
import { ActionApprovalError } from './errors.js';

const DEFAULT_NAMESPACE = 'totem_industrial_approvals:v1:';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalRequest {
  approvalId: string;
  commitmentHash: string;
  status: ApprovalStatus;
  requestedAt: number;
  actionId?: string;
  resourceId?: ResourceId;
  reason?: string;
  decidedAt?: number;
  approver?: string;
  expiresAt?: number;
}

export interface ApprovalValidation {
  valid: boolean;
  reason?: string;
}

export interface ApprovalRequestParams {
  commitmentHash: string;
  actionId?: string;
  resourceId?: ResourceId;
  reason?: string;
  expiresAt?: number;
}

export interface ApprovalRegistry {
  request(params: ApprovalRequestParams): Promise<ApprovalRequest>;
  approve(approvalId: string, approver: string): Promise<ApprovalRequest>;
  reject(approvalId: string, approver: string, reason?: string): Promise<ApprovalRequest>;
  get(approvalId: string): Promise<ApprovalRequest | undefined>;
  listPending(): Promise<ApprovalRequest[]>;
  /** Valid when approved, bound to the same commitment, and unexpired. */
  validate(approvalId: string, commitmentHash: string): Promise<ApprovalValidation>;
}

export interface DurableApprovalRegistryOptions {
  readonly namespace?: string;
  readonly requireAckMode?: WriteAckMode;
  readonly now?: () => number;
}

interface ApprovalState {
  approvals: Record<string, ApprovalRequest>;
}

export function createDurableApprovalRegistry(
  adapter: StorageAdapterWithCapabilities & CasStore,
  options: DurableApprovalRegistryOptions = {},
): ApprovalRegistry {
  const now = options.now ?? (() => Date.now());
  const snapshots: RevisionedSnapshotStore<ApprovalState> = createRevisionedSnapshotStore(adapter, {
    namespace: options.namespace ?? DEFAULT_NAMESPACE,
    requireAckMode: options.requireAckMode,
    empty: (): ApprovalState => ({ approvals: {} }),
    validate: assertApprovalState,
  });

  async function load(approvalId: string): Promise<ApprovalRequest | undefined> {
    const state: ApprovalState = await snapshots.load();
    return state.approvals[approvalId];
  }

  async function decide(
    approvalId: string,
    status: ApprovalStatus,
    approver: string,
    reason?: string,
  ): Promise<ApprovalRequest> {
    let updated: ApprovalRequest | undefined;
    await snapshots.mutate((state) => {
      const existing = state.approvals[approvalId];
      if (!existing) return state;
      updated = {
        ...existing,
        status,
        approver,
        decidedAt: now(),
        ...(reason !== undefined ? { reason } : {}),
      };
      return { ...state, approvals: { ...state.approvals, [approvalId]: updated } };
    });
    if (!updated) throw new ActionApprovalError(`approval '${approvalId}' not found`);
    return updated;
  }

  return {
    async request(params) {
      const requestedAt = now();
      const approvalId =
        'totem:ia:approval:' +
        hashCanonical('TOTEM_INDUSTRIAL_ACTION_APPROVAL_V1', {
          commitmentHash: params.commitmentHash,
          requestedAt,
        });
      const record: ApprovalRequest = {
        approvalId,
        commitmentHash: params.commitmentHash,
        status: 'pending',
        requestedAt,
        ...(params.actionId !== undefined ? { actionId: params.actionId } : {}),
        ...(params.resourceId !== undefined ? { resourceId: params.resourceId } : {}),
        ...(params.reason !== undefined ? { reason: params.reason } : {}),
        ...(params.expiresAt !== undefined ? { expiresAt: params.expiresAt } : {}),
      };
      await snapshots.mutate((state) => ({
        ...state,
        approvals: { ...state.approvals, [approvalId]: record },
      }));
      return record;
    },
    approve: (approvalId, approver) => decide(approvalId, 'approved', approver),
    reject: (approvalId, approver, reason) => decide(approvalId, 'rejected', approver, reason),
    get: (approvalId) => load(approvalId),
    async listPending() {
      const state: ApprovalState = await snapshots.load();
      return Object.values(state.approvals).filter((a) => a.status === 'pending');
    },
    async validate(approvalId, commitmentHash) {
      const approval = await load(approvalId);
      if (!approval) return { valid: false, reason: 'approval not found' };
      if (approval.status !== 'approved') return { valid: false, reason: `approval is ${approval.status}` };
      if (approval.commitmentHash !== commitmentHash) {
        return { valid: false, reason: 'approval is bound to a different action' };
      }
      if (approval.expiresAt !== undefined && now() > approval.expiresAt) {
        return { valid: false, reason: 'approval has expired' };
      }
      return { valid: true };
    },
  };
}

function assertApprovalState(state: ApprovalState): void {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    throw new StorageError('approval state is not an object', 'corrupt');
  }
  const value = (state as unknown as Record<string, unknown>).approvals;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new StorageError('approval state is missing section "approvals"', 'corrupt');
  }
}
