/**
 * HTLC expiry policy for multi-hop execution (OMN-079).
 *
 * Timeouts must decrease toward the recipient: an upstream hop must keep enough
 * room that, if the downstream hop fails, the intermediary can still learn the
 * outcome, contest a stale close and re-use the liquidity. The previous code
 * separated consecutive hops by exactly one block, which is only enough if
 * nothing ever needs a contest window — and channel contest delays are measured
 * in hundreds of blocks.
 *
 * The separation is therefore derived from the channel's contest delay plus a
 * confirmation margin, and the request's own expiry must have room for it.
 */

/** Default channel contest delay when the caller does not know better (blocks). */
export const DEFAULT_CONTEST_DELAY_BLOCKS = 256n;

export interface RouteExpiryOptions {
  /**
   * Explicit separation between consecutive hop timeouts. Overrides the derived
   * value; must be positive.
   */
  hopExpiryDelta?: bigint;
  /** Contest delay of the channels on the route (default 256). */
  contestDelayBlocks?: bigint;
  /** Confirmation margin added to the contest delay (default 1). */
  confirmations?: bigint;
}

/**
 * Blocks of separation required between consecutive hops.
 *
 * A downstream failure must leave the upstream HTLC alive long enough to be
 * resolved: at minimum the contest window of the channel that has to be closed
 * unilaterally, plus one confirmation.
 */
export function resolveHopExpiryDelta(options: RouteExpiryOptions = {}): bigint {
  if (options.hopExpiryDelta !== undefined) {
    if (options.hopExpiryDelta <= 0n) {
      throw new Error('hopExpiryDelta must be positive');
    }
    return options.hopExpiryDelta;
  }
  const contest = options.contestDelayBlocks ?? DEFAULT_CONTEST_DELAY_BLOCKS;
  if (contest < 0n) {
    throw new Error('contestDelayBlocks must not be negative');
  }
  const confirmations = options.confirmations ?? 1n;
  if (confirmations < 0n) {
    throw new Error('confirmations must not be negative');
  }
  return contest + confirmations;
}

/**
 * Absolute timeout for the hop at `position` (0 = closest to the sender).
 *
 * Throws rather than clamping: a request whose expiry cannot accommodate the
 * required separation must be rejected, not silently executed with one-block
 * gaps that the old code produced.
 */
export function hopTimeoutBlock(
  expiryBlock: bigint,
  position: number,
  delta: bigint,
): bigint {
  if (delta <= 0n) throw new Error('expiry delta must be positive');
  if (!Number.isInteger(position) || position < 0) {
    throw new Error(`hop position must be a non-negative integer, got ${String(position)}`);
  }
  const timeout = expiryBlock - BigInt(position) * delta;
  if (timeout <= 0n) {
    throw new Error(
      `payment expiry ${expiryBlock.toString()} leaves no room for hop ${position} `
      + `at ${delta.toString()} blocks of separation per hop`,
    );
  }
  return timeout;
}

/** Room check performed before any HTLC is locked. */
export function assertExpiryFits(
  expiryBlock: bigint,
  hopCount: number,
  delta: bigint,
): void {
  hopTimeoutBlock(expiryBlock, Math.max(0, hopCount - 1), delta);
}
