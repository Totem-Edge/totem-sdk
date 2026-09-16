/**
 * Durable liquidity-bond/claim registry (RFC-007 G6).
 *
 * Drop-in replacement for `MemoryLiquidityBondStore` backed by a storage
 * adapter instead of a heap object: the authoritative `LiquidityBondRegistryState`
 * is a single revision-CAS record (RFC-007 §4.2) so concurrent transitions
 * never lose an update, reopen preserves every pool/commitment/position/
 * receipt/allocation/fee/withdrawal record, and corruption is surfaced — never
 * treated as absence.
 */

import type {
  LiquidityBondRegistryState,
  LiquidityPoolManifest,
  LiquidityCommitment,
  LiquidityPosition,
  LiquidityReceipt,
  LiquidityAllocation,
  LiquidityFeeRecord,
  WithdrawalIntent,
} from './types.js';
import {
  createEmptyLiquidityBondRegistryState,
  registerLiquidityPool,
  updateLiquidityPool,
  registerLiquidityCommitment,
  registerLiquidityPosition,
  attachLiquidityReceipt,
  attachLiquidityAllocation,
  attachLiquidityFeeRecord,
  attachWithdrawalIntent,
  getLiquidityPool,
  getLiquidityPosition,
  getLiquidityReceipt,
  listLiquidityPools,
  listPositionsByPool,
  listPositionsByLp,
  listActivePositions,
  listWithdrawablePositions,
} from './registry.js';
import {
  createRevisionedSnapshotStore,
  type RevisionedSnapshotStore,
} from '@totemsdk/storage/snapshot';
import type { StorageAdapterWithCapabilities, CasStore, WriteAckMode } from '@totemsdk/storage/types';
import { StorageError } from '@totemsdk/storage/errors';

const DEFAULT_NAMESPACE = 'totem_liquidity_bond:v1:';

export interface DurableLiquidityBondStoreOptions {
  /** Key namespace prefix; default `totem_liquidity_bond:v1:`. */
  readonly namespace?: string;
  /**
   * Required write acknowledgment; default `durably-acknowledged`. Pass
   * `volatile` only for tests/scratch adapters (e.g. `MemoryStore`).
   */
  readonly requireAckMode?: WriteAckMode;
}

export interface DurableLiquidityBondStore {
  registerPool(pool: LiquidityPoolManifest): Promise<void>;
  updatePool(pool: LiquidityPoolManifest): Promise<void>;
  registerCommitment(commitment: LiquidityCommitment): Promise<void>;
  registerPosition(position: LiquidityPosition): Promise<void>;
  attachReceipt(receipt: LiquidityReceipt): Promise<void>;
  attachAllocation(allocation: LiquidityAllocation): Promise<void>;
  attachFeeRecord(record: LiquidityFeeRecord): Promise<void>;
  attachWithdrawalIntent(intent: WithdrawalIntent): Promise<void>;
  getPool(poolId: string): Promise<LiquidityPoolManifest | undefined>;
  getPosition(positionId: string): Promise<LiquidityPosition | undefined>;
  getReceipt(receiptId: string): Promise<LiquidityReceipt | undefined>;
  listPools(): Promise<LiquidityPoolManifest[]>;
  listPositionsByPool(poolId: string): Promise<LiquidityPosition[]>;
  listPositionsByLp(lpAddress: string): Promise<LiquidityPosition[]>;
  listActivePositions(): Promise<LiquidityPosition[]>;
  listWithdrawablePositions(now: number): Promise<LiquidityPosition[]>;
  getSnapshot(): Promise<LiquidityBondRegistryState>;
  /** Current registry transition counter (0 before the first write). */
  getRevision(): Promise<number>;
  /** True once any registry record has been persisted. */
  hasState(): Promise<boolean>;
}

function assertRegistryState(state: LiquidityBondRegistryState): void {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    throw new StorageError('liquidity-bond registry state is not an object', 'corrupt');
  }
  const sections = ['pools', 'commitments', 'positions', 'receipts', 'allocations', 'feeRecords', 'withdrawals'] as const;
  for (const section of sections) {
    const value = (state as unknown as Record<string, unknown>)[section];
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new StorageError(`liquidity-bond registry state is missing section "${section}"`, 'corrupt');
    }
  }
}

function cloneSnapshot(state: LiquidityBondRegistryState): LiquidityBondRegistryState {
  // Preserve MemoryLiquidityBondStore.getSnapshot semantics: bigint → string
  // JSON round-trip, a deep clone callers may mutate freely.
  return JSON.parse(JSON.stringify(state, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
}

export function createDurableLiquidityBondStore(
  adapter: StorageAdapterWithCapabilities & CasStore,
  options: DurableLiquidityBondStoreOptions = {},
): DurableLiquidityBondStore {
  const snapshots: RevisionedSnapshotStore<LiquidityBondRegistryState> = createRevisionedSnapshotStore(
    adapter,
    {
      namespace: options.namespace ?? DEFAULT_NAMESPACE,
      requireAckMode: options.requireAckMode,
      empty: () => createEmptyLiquidityBondRegistryState(),
      validate: assertRegistryState,
    },
  );

  async function mutate(fn: (state: LiquidityBondRegistryState) => LiquidityBondRegistryState): Promise<void> {
    await snapshots.mutate(fn);
  }

  return {
    async registerPool(pool: LiquidityPoolManifest): Promise<void> {
      await mutate((state) => registerLiquidityPool(state, pool));
    },
    async updatePool(pool: LiquidityPoolManifest): Promise<void> {
      await mutate((state) => updateLiquidityPool(state, pool));
    },
    async registerCommitment(commitment: LiquidityCommitment): Promise<void> {
      await mutate((state) => registerLiquidityCommitment(state, commitment));
    },
    async registerPosition(position: LiquidityPosition): Promise<void> {
      await mutate((state) => registerLiquidityPosition(state, position));
    },
    async attachReceipt(receipt: LiquidityReceipt): Promise<void> {
      await mutate((state) => attachLiquidityReceipt(state, receipt));
    },
    async attachAllocation(allocation: LiquidityAllocation): Promise<void> {
      await mutate((state) => attachLiquidityAllocation(state, allocation));
    },
    async attachFeeRecord(record: LiquidityFeeRecord): Promise<void> {
      await mutate((state) => attachLiquidityFeeRecord(state, record));
    },
    async attachWithdrawalIntent(intent: WithdrawalIntent): Promise<void> {
      await mutate((state) => attachWithdrawalIntent(state, intent));
    },
    async getPool(poolId: string): Promise<LiquidityPoolManifest | undefined> {
      return getLiquidityPool(await snapshots.load(), poolId);
    },
    async getPosition(positionId: string): Promise<LiquidityPosition | undefined> {
      return getLiquidityPosition(await snapshots.load(), positionId);
    },
    async getReceipt(receiptId: string): Promise<LiquidityReceipt | undefined> {
      return getLiquidityReceipt(await snapshots.load(), receiptId);
    },
    async listPools(): Promise<LiquidityPoolManifest[]> {
      return listLiquidityPools(await snapshots.load());
    },
    async listPositionsByPool(poolId: string): Promise<LiquidityPosition[]> {
      return listPositionsByPool(await snapshots.load(), poolId);
    },
    async listPositionsByLp(lpAddress: string): Promise<LiquidityPosition[]> {
      return listPositionsByLp(await snapshots.load(), lpAddress);
    },
    async listActivePositions(): Promise<LiquidityPosition[]> {
      return listActivePositions(await snapshots.load());
    },
    async listWithdrawablePositions(now: number): Promise<LiquidityPosition[]> {
      return listWithdrawablePositions(await snapshots.load(), now);
    },
    async getSnapshot(): Promise<LiquidityBondRegistryState> {
      return cloneSnapshot(await snapshots.load());
    },
    getRevision: () => snapshots.getRevision(),
    hasState: () => snapshots.hasState(),
  };
}