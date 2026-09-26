/**
 * @module @totemsdk/wots-lease/seed
 *
 * Watermark seeding for import/restore (RFC-013 §9). The safety property is
 * "never reissue a used leaf". A local watermark alone is insufficient across
 * devices/restores, so seeding draws from, in priority order:
 *
 *   1. the on-chain watermark cursor (advances the local watermark),
 *   2. an exported watermark blob,
 *   3. an operator-provided high-water mark.
 *
 * If none is available and the caller has not declared the keyspace fresh,
 * seeding **fails closed** — starting at 0 would reissue spent leaves.
 */

import type { LocalLeaseProvider } from './local.js';
import type { OnchainWatermarkProvider } from './onchain.js';
import type { LocalWatermark, WatermarkSeed } from './types.js';
import { flatIndex, fromFlatIndex } from './watermark.js';
import { WatermarkSeedRequiredError } from './errors.js';

export interface SeedLeaseWatermarkParams {
  readonly local: LocalLeaseProvider;
  readonly treeId: string;
  /** Layer 5 — the on-chain cursor is authoritative when reachable. */
  readonly onchain?: OnchainWatermarkProvider;
  /** Exported watermark blob. */
  readonly exported?: WatermarkSeed;
  /** Operator-provided flat high-water mark. */
  readonly operatorHighWaterMark?: number;
  /** Declares the keyspace fresh/unspent, so cursor 0 is safe. */
  readonly fresh?: boolean;
}

function flatOf(w: Pick<WatermarkSeed, 'addressCursor' | 'l1Cursor' | 'l2Cursor'>): number {
  return flatIndex({ addressIndex: w.addressCursor, l1: w.l1Cursor, l2: w.l2Cursor });
}

/**
 * Seed a local watermark from the best available source, requiring at least one
 * source unless `fresh` is set. Returns the resulting local watermark.
 *
 * @throws {WatermarkSeedRequiredError} when no source is available and the
 *   keyspace is not declared fresh.
 * @throws {WatermarkSeedRegressionError} when a supplied seed is behind the
 *   current cursor.
 */
export async function seedLeaseWatermark(
  params: SeedLeaseWatermarkParams,
): Promise<LocalWatermark> {
  const { local, treeId } = params;

  // 1. On-chain cursor — advances the same local watermark (monotonic).
  if (params.onchain) {
    try {
      await params.onchain.syncLeaseJournal();
    } catch {
      // Chain unreachable — fall through to exported/operator sources below.
    }
  }

  const current = await local.getLocalWatermark(treeId);
  let bestFlat = flatOf({ addressCursor: current.addressCursor, l1Cursor: current.l1Cursor, l2Cursor: current.l2Cursor });
  let best: WatermarkSeed | undefined;

  // 2. Exported blob.
  if (params.exported) {
    if (flatOf(params.exported) > bestFlat) {
      best = params.exported;
      bestFlat = flatOf(params.exported);
    }
  }

  // 3. Operator high-water mark.
  if (params.operatorHighWaterMark !== undefined) {
    const indices = fromFlatIndex(params.operatorHighWaterMark);
    const candidate: WatermarkSeed = {
      version: 1,
      treeId,
      addressCursor: indices.addressIndex,
      l1Cursor: indices.l1,
      l2Cursor: indices.l2,
      unavailable: [],
    };
    if (flatOf(candidate) > bestFlat) {
      best = candidate;
      bestFlat = flatOf(candidate);
    }
  }

  if (best) {
    await local.seedWatermark(best);
  }

  if (
    !params.onchain &&
    !params.exported &&
    params.operatorHighWaterMark === undefined &&
    !params.fresh
  ) {
    throw new WatermarkSeedRequiredError(treeId);
  }

  return local.getLocalWatermark(treeId);
}

/** Export a portable watermark blob for backup/restore. */
export function exportLeaseWatermark(
  local: LocalLeaseProvider,
  treeId: string,
): Promise<WatermarkSeed> {
  return local.exportWatermark(treeId);
}
