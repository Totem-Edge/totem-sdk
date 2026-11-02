/**
 * RFC-011 §4.8 — resource locks (mutual exclusion).
 *
 * Two actions must not actuate the same resource concurrently. Locks are held
 * in a durable revision-CAS snapshot so mutual exclusion survives restart and
 * concurrent acquisition is serialized. Locks may expire by TTL.
 */

import {
  createRevisionedSnapshotStore,
  type RevisionedSnapshotStore,
} from '@totemsdk/storage/snapshot';
import type { StorageAdapterWithCapabilities, CasStore, WriteAckMode } from '@totemsdk/storage/types';
import { StorageError } from '@totemsdk/storage/errors';
import type { ResourceId } from './resources.js';
import { resourceIdKey } from './resources.js';

const DEFAULT_NAMESPACE = 'totem_industrial_locks:v1:';

export interface ResourceLock {
  resourceKey: string;
  holderId: string;
  acquiredAt: number;
  expiresAt?: number;
}

export interface AcquireResult {
  acquired: boolean;
  /** The blocking lock when `acquired` is false, or the granted lock when true. */
  lock?: ResourceLock;
}

export interface ResourceLockManager {
  acquire(resourceId: ResourceId, holderId: string, opts?: { ttlMs?: number }): Promise<AcquireResult>;
  release(resourceId: ResourceId, holderId: string): Promise<boolean>;
  isLocked(resourceId: ResourceId): Promise<ResourceLock | undefined>;
}

export interface DurableResourceLockManagerOptions {
  readonly namespace?: string;
  readonly requireAckMode?: WriteAckMode;
  readonly now?: () => number;
}

interface LockState {
  locks: Record<string, ResourceLock>;
}

function isLive(lock: ResourceLock, now: number): boolean {
  return lock.expiresAt === undefined || lock.expiresAt > now;
}

export function createDurableResourceLockManager(
  adapter: StorageAdapterWithCapabilities & CasStore,
  options: DurableResourceLockManagerOptions = {},
): ResourceLockManager {
  const now = options.now ?? (() => Date.now());
  const snapshots: RevisionedSnapshotStore<LockState> = createRevisionedSnapshotStore(adapter, {
    namespace: options.namespace ?? DEFAULT_NAMESPACE,
    requireAckMode: options.requireAckMode,
    empty: (): LockState => ({ locks: {} }),
    validate: assertLockState,
  });

  return {
    async acquire(resourceId, holderId, opts) {
      const key = resourceIdKey(resourceId);
      const at = now();
      const ttlMs = opts?.ttlMs;
      let result: AcquireResult = { acquired: false };
      await snapshots.mutate((state) => {
        const existing = state.locks[key];
        if (existing && isLive(existing, at) && existing.holderId !== holderId) {
          result = { acquired: false, lock: existing };
          return state;
        }
        const lock: ResourceLock = {
          resourceKey: key,
          holderId,
          acquiredAt: at,
          ...(ttlMs !== undefined ? { expiresAt: at + ttlMs } : {}),
        };
        result = { acquired: true, lock };
        return { ...state, locks: { ...state.locks, [key]: lock } };
      });
      return result;
    },

    async release(resourceId, holderId) {
      const key = resourceIdKey(resourceId);
      let released = false;
      await snapshots.mutate((state) => {
        const existing = state.locks[key];
        if (!existing || existing.holderId !== holderId) return state;
        released = true;
        const locks = { ...state.locks };
        delete locks[key];
        return { ...state, locks };
      });
      return released;
    },

    async isLocked(resourceId) {
      const state: LockState = await snapshots.load();
      const lock = state.locks[resourceIdKey(resourceId)];
      if (!lock || !isLive(lock, now())) return undefined;
      return lock;
    },
  };
}

function assertLockState(state: LockState): void {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    throw new StorageError('resource-lock state is not an object', 'corrupt');
  }
  const value = (state as unknown as Record<string, unknown>).locks;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new StorageError('resource-lock state is missing section "locks"', 'corrupt');
  }
}
