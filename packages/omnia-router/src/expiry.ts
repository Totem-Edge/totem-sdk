/**
 * Per-hop HTLC expiry planning (OMN-081).
 *
 * The executor used to space consecutive deadlines one block apart
 * (`expiryBlock - i`), regardless of the channel's contest period. An
 * intermediary that needs to claim downstream and refund upstream therefore had
 * one block of slack to do it in.
 *
 * The spread is now derived from the channel's own script: each hop needs the
 * eltoo contest window (`contestDelayBlocks`, embedded in the funding script)
 * plus a recovery margin for confirmation, reorg and retry. Policy may *raise*
 * the delta but never lower it below the contest period, so a stale config
 * cannot reintroduce the defect.
 */
import type { Route, RouterChannel } from './types.js';

export interface ExpiryPolicy {
  /**
   * Blocks added on top of the contest delay for confirmation/recovery.
   * Default 1.
   */
  recoveryMarginBlocks?: number;
  /**
   * Operator floor, in blocks per hop. Used only when it exceeds the derived
   * value — it cannot shrink the spread below a channel's contest period.
   */
  minHopExpiryDelta?: bigint;
  /**
   * Contest delay assumed for a channel that does not declare one. Default 0,
   * which reproduces the legacy one-block spread. Production hosts pass the
   * documented eltoo default (256) instead.
   */
  defaultContestDelayBlocks?: number;
  /**
   * Refuse to route through a channel with no declared contest delay rather
   * than assuming one. Default false.
   */
  requireContestDelay?: boolean;
  /** Current chain tip, when known, so the window can be checked. */
  tipBlock?: bigint;
  /** Blocks of headroom the earliest HTLC must keep above the tip. Default 0. */
  minLeadBlocks?: bigint;
}

export interface ExpiryPlan {
  /** Blocks between consecutive HTLC deadlines. */
  delta: bigint;
  /** Largest contest delay across the route's channels. */
  contestDelayBlocks: bigint;
  recoveryMarginBlocks: bigint;
  /** Deadline of the last lock (closest to the recipient). */
  earliest: bigint;
}

export type ExpiryPlanResult =
  | { ok: true; plan: ExpiryPlan }
  | { ok: false; error: string };

/**
 * Deadline of the `index`-th HTLC lock, counting from the payer.
 *
 * Timeouts decrease toward the recipient: the downstream HTLC expires first so
 * the intermediary can claim it before its own incoming HTLC becomes
 * refundable.
 */
export function hopTimeout(expiryBlock: bigint, delta: bigint, index: number | bigint): bigint {
  return expiryBlock - BigInt(index) * delta;
}

/**
 * Derive the expiry delta for a route and check it fits the requested window.
 *
 * `lockCount` is the number of HTLC locks the execution will place — one per
 * routing hop, two per swap hop — not the number of route hops.
 */
export function planRouteExpiry(
  channels: Map<string, RouterChannel>,
  route: Route,
  expiryBlock: bigint,
  lockCount: number,
  policy: ExpiryPolicy = {},
): ExpiryPlanResult {
  const errors: string[] = [];
  let contestDelayBlocks = 0n;

  for (const hop of route.hops) {
    const channel = channels.get(hop.channelId);
    const declared = channel?.contestDelayBlocks;
    if (declared === undefined) {
      if (policy.requireContestDelay) {
        errors.push(`channel ${hop.channelId} does not declare contestDelayBlocks`);
        continue;
      }
      const fallback = BigInt(Math.max(0, Math.trunc(policy.defaultContestDelayBlocks ?? 0)));
      if (fallback > contestDelayBlocks) contestDelayBlocks = fallback;
      continue;
    }
    const value = BigInt(Math.max(0, Math.trunc(declared)));
    if (value > contestDelayBlocks) contestDelayBlocks = value;
  }

  const recoveryMarginBlocks = BigInt(Math.max(0, Math.trunc(policy.recoveryMarginBlocks ?? 1)));
  const derived = contestDelayBlocks + recoveryMarginBlocks;
  const floor = derived > 0n ? derived : 1n;
  const override = policy.minHopExpiryDelta ?? 0n;
  const delta = override > floor ? override : floor;

  const locks = Math.max(1, lockCount);
  const earliest = expiryBlock - BigInt(locks - 1) * delta;
  if (earliest < 1n) {
    errors.push(
      `expiry window ${expiryBlock.toString()} cannot fit ${locks} locks `
      + `at ${delta.toString()} blocks apart`,
    );
  }
  if (policy.tipBlock !== undefined) {
    const lead = policy.minLeadBlocks ?? 0n;
    if (earliest <= policy.tipBlock + lead) {
      errors.push(
        `earliest HTLC deadline ${earliest.toString()} does not clear the tip `
        + `${policy.tipBlock.toString()} by ${lead.toString()} blocks`,
      );
    }
  }

  if (errors.length > 0) return { ok: false, error: errors.join('; ') };
  return {
    ok: true,
    plan: { delta, contestDelayBlocks, recoveryMarginBlocks, earliest },
  };
}
