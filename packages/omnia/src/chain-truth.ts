import { ELTOO_CONTEST_DELAY_BLOCKS } from './script.js';
import type { OmniaChannel } from './types.js';

/** Minimal structural view of a chain coin needed for confirmation checks. */
export interface ChainCoinView {
  /** Block height at which the coin was created. */
  created?: string | number;
}

/**
 * Block height at which a coin was created, or `null` when the provider does not
 * report a usable height.
 *
 * `mmrentry` is an MMR leaf index, not a block height — using it as a
 * confirmation height silently treats an unconfirmed coin as deeply confirmed.
 * Calling code must treat `null` as unconfirmed (fail closed).
 */
export function coinCreatedBlock(coin: ChainCoinView | null | undefined): number | null {
  if (!coin || coin.created === undefined || coin.created === null) return null;
  const value = Number(coin.created);
  if (!Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

/**
 * Confirmation depth of a coin at `tipBlock`, or `null` when the depth cannot be
 * proven (missing/invalid creation height, or a future-dated coin).
 */
export function confirmationsAt(
  coin: ChainCoinView | null | undefined,
  tipBlock: number,
): number | null {
  const created = coinCreatedBlock(coin);
  if (created === null) return null;
  if (!Number.isSafeInteger(tipBlock) || created > tipBlock) return null;
  return tipBlock - created;
}

/**
 * The contest window this channel was actually opened with. The script embeds
 * `contestDelayBlocks`; settlement logic must use the same value rather than the
 * module default.
 */
export function channelContestDelay(channel: Pick<OmniaChannel, 'contestDelayBlocks'>): number {
  const delay = channel.contestDelayBlocks;
  if (typeof delay === 'number' && Number.isSafeInteger(delay) && delay >= 0) return delay;
  return ELTOO_CONTEST_DELAY_BLOCKS;
}
