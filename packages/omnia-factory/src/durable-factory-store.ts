/**
 * Durable factory signing-state store (RFC-007 G9).
 *
 * `createFactory`/`acceptFactory`/`reallocate` are pure functions that return
 * updated `ChannelFactory` records; this store makes the actionable part of that
 * state — `pendingCommitment`, `pendingSignatures` (partial-signature counts),
 * and `stateLog` — durable, so it survives a host restart with no partial-funding
 * loss. A factory that was mid-signing-round (N of N signatures collected) reopens
 * with every already-collected signature intact and can resume exactly where it
 * left off.
 *
 * Backed by the shared revision-CAS snapshot store: single-key, whole-record
 * update, corruption surfaced (never treated as absence), no silent downgrade.
 */

import {
  createRevisionedSnapshotStore,
  type RevisionedSnapshotStore,
} from '@totemsdk/storage/snapshot';
import type { StorageAdapterWithCapabilities, CasStore, WriteAckMode } from '@totemsdk/storage/types';
import { StorageError } from '@totemsdk/storage/errors';
import type { ChannelFactory } from './types.js';

const DEFAULT_NAMESPACE = 'totem_omnia_factory:v1:';

export interface FactoryRegistryState {
  factories: Record<string, ChannelFactory>;
}

export interface DurableFactoryStoreOptions {
  /** Key namespace prefix; default `totem_omnia_factory:v1:`. */
  readonly namespace?: string;
  /**
   * Required write acknowledgment; default `durably-acknowledged`. Pass
   * `volatile` only for tests/scratch adapters (e.g. `MemoryStore`).
   */
  readonly requireAckMode?: WriteAckMode;
}

export interface DurableFactoryStore {
  /** Persist a factory (create/accept/reallocate state transition). */
  saveFactory(factory: ChannelFactory): Promise<void>;
  getFactory(factoryId: string): Promise<ChannelFactory | undefined>;
  /** All factories known to the registry. */
  listFactories(): Promise<ChannelFactory[]>;
  /** Current registry transition counter (0 before the first write). */
  getRevision(): Promise<number>;
  /** True once any factory record has been persisted. */
  hasState(): Promise<boolean>;
  /** Current persisted registry state. */
  getSnapshot(): Promise<FactoryRegistryState>;
}

function assertRegistryState(state: FactoryRegistryState): void {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    throw new StorageError('omnia-factory registry state is not an object', 'corrupt');
  }
  const value = (state as unknown as Record<string, unknown>).factories;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new StorageError('omnia-factory registry state is missing section "factories"', 'corrupt');
  }
}

export function createDurableFactoryStore(
  adapter: StorageAdapterWithCapabilities & CasStore,
  options: DurableFactoryStoreOptions = {},
): DurableFactoryStore {
  const snapshots: RevisionedSnapshotStore<FactoryRegistryState> = createRevisionedSnapshotStore(
    adapter,
    {
      namespace: options.namespace ?? DEFAULT_NAMESPACE,
      requireAckMode: options.requireAckMode,
      empty: (): FactoryRegistryState => ({ factories: {} }),
      validate: assertRegistryState,
    },
  );

  async function mutate(fn: (state: FactoryRegistryState) => FactoryRegistryState): Promise<void> {
    await snapshots.mutate(fn);
  }

  return {
    async saveFactory(factory: ChannelFactory): Promise<void> {
      await mutate((state) => {
        const factories = { ...state.factories, [factory.factoryId]: factory };
        return { ...state, factories };
      });
    },

    async getFactory(factoryId: string): Promise<ChannelFactory | undefined> {
      return (await snapshots.load()).factories[factoryId];
    },

    async listFactories(): Promise<ChannelFactory[]> {
      return Object.values((await snapshots.load()).factories);
    },

    getRevision: () => snapshots.getRevision(),
    hasState: () => snapshots.hasState(),
    async getSnapshot(): Promise<FactoryRegistryState> {
      return snapshots.load();
    },
  };
}