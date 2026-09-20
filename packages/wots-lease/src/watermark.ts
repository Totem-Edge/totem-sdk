/**
 * WotsWatermarkStore — canonical v3 implementation
 *
 * - Reads v1 (flat usedIndices) and v2 (per-address usedIndices) automatically on load.
 * - Writes only v3.
 * - Enforces monotonicity: unavailable map can only grow, cursors can only advance.
 * - Storage key unchanged ('totem_wots_watermark') to avoid storage churn.
 */

import type { StorageAdapter, LoggerAdapter } from '@totemsdk/core';
import { NoopLogger } from '@totemsdk/core';
import type {
  WotsWatermarkState,
  TreeWatermark,
  SigningIndices,
  UnavailableReason,
  LocalWatermark,
} from './types.js';
import { WatermarkMonotonicityError, WatermarkExhaustedError } from './errors.js';

const STORAGE_KEY = 'totem_wots_watermark';
const MAX_L = 64;
const CAPACITY_PER_TREE = MAX_L * MAX_L * MAX_L;
const DEFAULT_TREE = 'default';

export function flatIndex(idx: SigningIndices): number {
  assertValidSigningIndices(idx);
  return idx.addressIndex * MAX_L * MAX_L + idx.l1 * MAX_L + idx.l2;
}

export function fromFlatIndex(flat: number): SigningIndices {
  if (!Number.isSafeInteger(flat) || flat < 0 || flat >= CAPACITY_PER_TREE) {
    throw new RangeError(`WOTS flat index must be an integer in [0, ${CAPACITY_PER_TREE - 1}]`);
  }
  const addressIndex = Math.floor(flat / (MAX_L * MAX_L));
  const rem = flat % (MAX_L * MAX_L);
  const l1 = Math.floor(rem / MAX_L);
  const l2 = rem % MAX_L;
  return { addressIndex, l1, l2 };
}

export function assertValidSigningIndices(indices: SigningIndices): void {
  for (const name of ['addressIndex', 'l1', 'l2'] as const) {
    const value = indices[name];
    if (!Number.isSafeInteger(value) || value < 0 || value >= MAX_L) {
      throw new RangeError(`WOTS ${name} must be an integer in [0, ${MAX_L - 1}]`);
    }
  }
}

function emptyTree(treeId: string): TreeWatermark {
  return { treeId, addressCursor: 0, l1Cursor: 0, l2Cursor: 0, unavailable: {} };
}

function nextIndices(cur: SigningIndices): SigningIndices | null {
  let { addressIndex, l1, l2 } = cur;
  l2++;
  if (l2 >= MAX_L) { l2 = 0; l1++; }
  if (l1 >= MAX_L) { l1 = 0; addressIndex++; }
  if (addressIndex >= MAX_L) return null;
  return { addressIndex, l1, l2 };
}

/**
 * Monotonic merge of two watermark states: the cursor is the further of the
 * two and the unavailable maps are unioned, so merging never re-exposes a used
 * index. Used to pick up writes made by another provider over the same storage
 * (AUD-004).
 */
function mergeWatermarkState(a: WotsWatermarkState | null, b: WotsWatermarkState): WotsWatermarkState {
  if (!a) return b;
  const trees: Record<string, TreeWatermark> = { ...a.trees };
  for (const [treeId, bt] of Object.entries(b.trees)) {
    const at = trees[treeId];
    if (!at) {
      trees[treeId] = bt;
      continue;
    }
    const aFlat = flatIndex({ addressIndex: at.addressCursor, l1: at.l1Cursor, l2: at.l2Cursor });
    const bFlat = flatIndex({ addressIndex: bt.addressCursor, l1: bt.l1Cursor, l2: bt.l2Cursor });
    const cursor = bFlat > aFlat ? bt : at;
    const lastSync = Math.max(at.lastSyncTimestamp ?? 0, bt.lastSyncTimestamp ?? 0);
    trees[treeId] = {
      treeId,
      addressCursor: cursor.addressCursor,
      l1Cursor: cursor.l1Cursor,
      l2Cursor: cursor.l2Cursor,
      unavailable: { ...bt.unavailable, ...at.unavailable },
      ...(lastSync > 0 ? { lastSyncTimestamp: lastSync } : {}),
    };
  }
  return { version: 3, trees };
}

type V1State = { next_addressIndex?: number; next_l1?: number; next_l2?: number; usedIndices?: Array<[number, number, number]> };
type V2State = { version: 2; addresses: Record<number, { next_l1: number; next_l2: number; usedIndices: [number, number][] }> };
type V3State = WotsWatermarkState;
type RawState = V1State | V2State | V3State | null;

function migrateToV3(raw: RawState): WotsWatermarkState {
  if (!raw) {
    return { version: 3, trees: {} };
  }

  if ('version' in raw && (raw as { version: number }).version === 3) {
    return raw as V3State;
  }

  if ('version' in raw && (raw as { version: number }).version === 2) {
    const v2 = raw as V2State;
    const tree = emptyTree(DEFAULT_TREE);
    let maxFlat = -1;
    for (const [addrIdxStr, addrData] of Object.entries(v2.addresses)) {
      const addressIndex = Number(addrIdxStr);
      for (const [l1, l2] of addrData.usedIndices) {
        const f = flatIndex({ addressIndex, l1, l2 });
        tree.unavailable[f] = 'committed';
        if (f > maxFlat) maxFlat = f;
      }
      const curFlat = flatIndex({ addressIndex, l1: addrData.next_l1, l2: addrData.next_l2 });
      if (curFlat > maxFlat) maxFlat = curFlat;
    }
    if (maxFlat >= 0) {
      const cur = fromFlatIndex(maxFlat);
      tree.addressCursor = cur.addressIndex;
      tree.l1Cursor = cur.l1;
      tree.l2Cursor = cur.l2;
    }
    return { version: 3, trees: { [DEFAULT_TREE]: tree } };
  }

  const v1 = raw as V1State;
  const tree = emptyTree(DEFAULT_TREE);
  for (const [ai, l1, l2] of v1.usedIndices ?? []) {
    const f = flatIndex({ addressIndex: ai, l1, l2 });
    tree.unavailable[f] = 'committed';
  }
  tree.addressCursor = v1.next_addressIndex ?? 0;
  tree.l1Cursor = v1.next_l1 ?? 0;
  tree.l2Cursor = v1.next_l2 ?? 0;
  return { version: 3, trees: { [DEFAULT_TREE]: tree } };
}

export class WotsWatermarkStore {
  private state: WotsWatermarkState | null = null;
  private _initialized = false;
  private readonly logger: LoggerAdapter;

  constructor(
    private readonly storage: StorageAdapter,
    logger: LoggerAdapter = new NoopLogger(),
  ) {
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;
    const raw = await this.storage.get<RawState>(STORAGE_KEY);
    this.state = migrateToV3(raw);
    if (!('version' in (raw ?? {})) || (raw as { version?: number }).version !== 3) {
      await this.persist();
      this.logger.info('[WotsWatermarkStore] Migrated to v3');
    }
    this._initialized = true;
  }

  private ensureInit(): WotsWatermarkState {
    if (!this.state) throw new Error('WotsWatermarkStore not initialized — call initialize() first');
    return this.state;
  }

  private async persist(): Promise<void> {
    await this.storage.set(STORAGE_KEY, this.state);
  }

  /**
   * Reload the persisted watermark and merge it monotonically into the local
   * state. A provider that shares its storage with another provider (AUD-004)
   * must call this inside its mutation critical section before allocating or
   * marking, so it observes writes it did not make and never re-issues a slot
   * another instance already took.
   */
  async refresh(): Promise<void> {
    if (!this._initialized || !this.state) return;
    const raw = await this.storage.get<RawState>(STORAGE_KEY);
    this.state = mergeWatermarkState(this.state, migrateToV3(raw));
  }

  private getOrCreateTree(treeId: string): TreeWatermark {
    const s = this.ensureInit();
    if (!s.trees[treeId]) {
      s.trees[treeId] = emptyTree(treeId);
    }
    return s.trees[treeId];
  }

  getNextIndices(treeId: string): SigningIndices {
    const tree = this.getOrCreateTree(treeId);
    let cur: SigningIndices = {
      addressIndex: tree.addressCursor,
      l1: tree.l1Cursor,
      l2: tree.l2Cursor,
    };
    let attempts = 0;
    while (attempts < CAPACITY_PER_TREE) {
      if (!tree.unavailable[flatIndex(cur)]) return cur;
      const nxt = nextIndices(cur);
      if (!nxt) break;
      cur = nxt;
      attempts++;
    }
    throw new WatermarkExhaustedError(treeId);
  }

  async markUnavailable(
    treeId: string,
    indices: SigningIndices,
    reason: UnavailableReason,
  ): Promise<void> {
    const tree = this.getOrCreateTree(treeId);
    const f = flatIndex(indices);
    tree.unavailable[f] = reason;
    const nxt = nextIndices(indices);
    if (nxt) {
      const nxtFlat = flatIndex(nxt);
      const curFlat = flatIndex({ addressIndex: tree.addressCursor, l1: tree.l1Cursor, l2: tree.l2Cursor });
      if (nxtFlat > curFlat) {
        tree.addressCursor = nxt.addressIndex;
        tree.l1Cursor = nxt.l1;
        tree.l2Cursor = nxt.l2;
      }
    }
    await this.persist();
  }

  isUnavailable(treeId: string, indices: SigningIndices): boolean {
    const s = this.ensureInit();
    const tree = s.trees[treeId];
    if (!tree) return false;
    const index = flatIndex(indices);
    const cursor = flatIndex({
      addressIndex: tree.addressCursor,
      l1: tree.l1Cursor,
      l2: tree.l2Cursor,
    });
    return index < cursor || index in tree.unavailable;
  }

  async save(treeId: string, patch: Partial<TreeWatermark>): Promise<void> {
    const s = this.ensureInit();
    const existing = s.trees[treeId] ?? emptyTree(treeId);
    const merged: TreeWatermark = { ...existing, ...patch, treeId };

    const existingFlat = flatIndex({ addressIndex: existing.addressCursor, l1: existing.l1Cursor, l2: existing.l2Cursor });
    const newFlat = flatIndex({ addressIndex: merged.addressCursor, l1: merged.l1Cursor, l2: merged.l2Cursor });
    if (newFlat < existingFlat) {
      throw new WatermarkMonotonicityError(
        `Cannot decrease watermark cursor for ${treeId}: ${existingFlat} → ${newFlat}`,
      );
    }

    const existingUnavailCount = Object.keys(existing.unavailable).length;
    const newUnavailCount = Object.keys(merged.unavailable).length;
    if (newUnavailCount < existingUnavailCount) {
      throw new WatermarkMonotonicityError(
        `Cannot shrink unavailable map for ${treeId}: ${existingUnavailCount} → ${newUnavailCount}`,
      );
    }

    s.trees[treeId] = merged;
    await this.persist();
  }

  getLocalWatermark(treeId: string): LocalWatermark {
    const s = this.ensureInit();
    const tree = s.trees[treeId] ?? emptyTree(treeId);
    return {
      treeId,
      addressCursor: tree.addressCursor,
      l1Cursor: tree.l1Cursor,
      l2Cursor: tree.l2Cursor,
      unavailableCount: Object.keys(tree.unavailable).length,
      capacity: CAPACITY_PER_TREE,
      lastSyncTimestamp: tree.lastSyncTimestamp,
    };
  }

  getRawState(): WotsWatermarkState {
    return this.ensureInit();
  }

  async clear(): Promise<void> {
    this.state = { version: 3, trees: {} };
    this._initialized = false;
    await this.storage.remove(STORAGE_KEY);
  }
}
