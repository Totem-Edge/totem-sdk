/**
 * Durable VTXO/pool snapshot store (RFC-007 G6).
 *
 * Drop-in replacement for `MemoryOmniaVtxoStore` — same `OmniaVtxoStore` port
 * — backed by a storage adapter instead of heap maps: the whole pool/VTXO
 * registry is a single revision-CAS snapshot record, so concurrent pool/VTXO
 * transitions never lose an update, reopen restores every VTXO (incl. spent
 * status and history), and corruption is surfaced — never treated as absence.
 */

import {
  createRevisionedSnapshotStore,
  type RevisionedSnapshotStore,
} from '@totemsdk/storage/snapshot';
import type { StorageAdapterWithCapabilities, CasStore, WriteAckMode } from '@totemsdk/storage/types';
import { StorageError } from '@totemsdk/storage/errors';
import type {
  OmniaVtxo,
  OmniaVtxoPool,
  OmniaVtxoStore,
  VtxoId,
} from './types.js';
import { VtxoStatusError } from './errors.js';

const DEFAULT_NAMESPACE = 'totem_omnia_vtxo:v1:';

export interface OmniaVtxoRegistryState {
  pools: Record<string, OmniaVtxoPool>;
  vtxos: Record<string, OmniaVtxo>;
}

export interface DurableOmniaVtxoStoreOptions {
  /** Key namespace prefix; default `totem_omnia_vtxo:v1:`. */
  readonly namespace?: string;
  /**
   * Required write acknowledgment; default `durably-acknowledged`. Pass
   * `volatile` only for tests/scratch adapters (e.g. `MemoryStore`).
   */
  readonly requireAckMode?: WriteAckMode;
}

export interface DurableOmniaVtxoStore extends OmniaVtxoStore {
  /** Current registry transition counter (0 before the first write). */
  getRevision(): Promise<number>;
  /** True once any snapshot record has been persisted. */
  hasState(): Promise<boolean>;
  /** Current persisted snapshot state (pool + vtxo maps). */
  getSnapshot(): Promise<OmniaVtxoRegistryState>;
}

function assertRegistryState(state: OmniaVtxoRegistryState): void {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    throw new StorageError('omnia-vtxo registry state is not an object', 'corrupt');
  }
  for (const section of ['pools', 'vtxos'] as const) {
    const value = (state as unknown as Record<string, unknown>)[section];
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new StorageError(`omnia-vtxo registry state is missing section "${section}"`, 'corrupt');
    }
  }
}

export function createDurableOmniaVtxoStore(
  adapter: StorageAdapterWithCapabilities & CasStore,
  options: DurableOmniaVtxoStoreOptions = {},
): DurableOmniaVtxoStore {
  const snapshots: RevisionedSnapshotStore<OmniaVtxoRegistryState> = createRevisionedSnapshotStore(
    adapter,
    {
      namespace: options.namespace ?? DEFAULT_NAMESPACE,
      requireAckMode: options.requireAckMode,
      empty: (): OmniaVtxoRegistryState => ({ pools: {}, vtxos: {} }),
      validate: assertRegistryState,
    },
  );

  async function mutate(fn: (state: OmniaVtxoRegistryState) => OmniaVtxoRegistryState): Promise<void> {
    await snapshots.mutate(fn);
  }

  return {
    async savePool(pool: OmniaVtxoPool): Promise<void> {
      await mutate((state) => {
        const pools = { ...state.pools, [pool.poolId]: pool };
        return { ...state, pools };
      });
    },

    async getPool(poolId: string): Promise<OmniaVtxoPool | undefined> {
      return (await snapshots.load()).pools[poolId];
    },

    async saveVtxo(vtxo: OmniaVtxo): Promise<void> {
      await mutate((state) => {
        const vtxos = { ...state.vtxos, [vtxo.vtxoId]: vtxo };
        return { ...state, vtxos };
      });
    },

    async getVtxo(vtxoId: VtxoId): Promise<OmniaVtxo | undefined> {
      return (await snapshots.load()).vtxos[vtxoId];
    },

    async listVtxos(poolId?: string): Promise<OmniaVtxo[]> {
      const state: OmniaVtxoRegistryState = await snapshots.load();
      const all = Object.values(state.vtxos);
      if (poolId === undefined) return all;
      return all.filter((v) => v.poolId === poolId);
    },

    async markVtxoSpent(vtxoId: VtxoId, now?: number): Promise<void> {
      await mutate((state) => {
        const existing = state.vtxos[vtxoId];
        if (!existing) {
          // Preserve MemoryOmniaVtxoStore error behaviour exactly.
          throw new Error(`VTXO ${vtxoId} not found`);
        }
        if (existing.status !== 'active') {
          throw new VtxoStatusError(
            `Cannot mark VTXO ${vtxoId} as spent: status is '${existing.status}'`,
            existing.status,
          );
        }
        const ts = now !== undefined ? now : Date.now();
        const vtxos = {
          ...state.vtxos,
          [vtxoId]: {
            ...existing,
            status: 'spent' as const,
            updatedAt: ts,
            history: [...existing.history, { op: 'spent' as const, at: ts }],
          },
        };
        return { ...state, vtxos };
      });
    },

    getRevision: () => snapshots.getRevision(),
    hasState: () => snapshots.hasState(),
    async getSnapshot(): Promise<OmniaVtxoRegistryState> {
      return snapshots.load();
    },
  };
}