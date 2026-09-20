import { sha3_256, canonicalJson, toHex } from '@totemsdk/proof';
import type {
  ActionIntent,
  AuthorityUsage,
  AuthorityUsageSnapshot,
  UsageLimit,
} from './types.js';

export function checkUsageLimit(
  snapshot: AuthorityUsageSnapshot,
  limit: UsageLimit,
  _now: number,
  proposed?: { count: number; amount?: string },
): boolean {
  // No "window expired => allow" shortcut (AUD-018). The snapshot is always
  // built for the window containing `now` (see snapshotFromUsage), and the
  // proposed delta is ALWAYS validated against the cap: a new window resets the
  // accumulated totals, it never disables the limit.
  if (limit.maxCount !== undefined) {
    const proposedCount = proposed?.count ?? 0;
    if (snapshot.totalCount + proposedCount > limit.maxCount) {
      return false;
    }
  }

  if (limit.maxTotal !== undefined) {
    const current = BigInt(snapshot.totalAmount ?? '0');
    const proposedAmount = proposed?.amount ? BigInt(proposed.amount) : 0n;
    if (current + proposedAmount > BigInt(limit.maxTotal)) {
      return false;
    }
  }

  return true;
}

export function calculateUsageDelta(action: ActionIntent): {
  count: number;
  amount?: string;
} {
  const count = 1;
  const amount = action.constraints?.amount as string | undefined;
  return { count, amount };
}

const DOMAIN_USAGE_ROOT = 'TOTEM_AUTHORITY_USAGE_ROOT_V1';

export function computeUsageRoot(receipts: AuthorityUsage[]): string {
  const inputs = receipts
    .map((r) => ({
      usageId: r.usageId,
      mandateProofId: r.mandateProofId,
      intentId: r.intentId,
      usedAt: r.usedAt,
      count: r.countsToward?.count ?? 1,
      amount: r.countsToward?.amount,
    }))
    .sort((a, b) => a.usageId.localeCompare(b.usageId));
  const input = DOMAIN_USAGE_ROOT + canonicalJson(inputs);
  return toHex(sha3_256(new TextEncoder().encode(input)));
}

export function snapshotFromUsage(
  usages: AuthorityUsage[],
  now: number,
  limit?: UsageLimit,
): AuthorityUsageSnapshot {
  let windowStart: number | undefined;
  let windowEnd: number | undefined;

  if (limit?.windowMs !== undefined && limit.windowMs > 0) {
    // Anchor to the window containing `now` (AUD-018). Never to the earliest
    // historical receipt: that anchored the window in the past, filtered out
    // current usage, and retired the limit as soon as the first window passed.
    windowStart = Math.floor(now / limit.windowMs) * limit.windowMs;
    windowEnd = windowStart + limit.windowMs;
  }

  let totalCount = 0;
  let totalAmount: string | undefined;

  for (const u of usages) {
    if (windowStart !== undefined && windowEnd !== undefined) {
      if (u.usedAt < windowStart || u.usedAt >= windowEnd) continue;
    }

    totalCount += u.countsToward?.count ?? 1;

    if (u.countsToward?.amount !== undefined) {
      const current = BigInt(totalAmount ?? '0');
      totalAmount = (current + BigInt(u.countsToward.amount)).toString();
    }
  }

  return {
    mandateProofId: usages.length > 0 ? usages[0].mandateProofId : '',
    totalCount,
    totalAmount,
    windowStart,
    windowEnd,
  };
}
