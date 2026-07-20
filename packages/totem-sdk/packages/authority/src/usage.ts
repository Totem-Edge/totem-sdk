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
  now: number,
): boolean {
  if (limit.windowMs !== undefined && snapshot.windowStart !== undefined) {
    if (now > snapshot.windowStart + limit.windowMs) {
      return true;
    }
  }

  if (limit.maxCount !== undefined && snapshot.totalCount >= limit.maxCount) {
    return false;
  }

  if (limit.maxTotal !== undefined && snapshot.totalAmount !== undefined) {
    if (BigInt(snapshot.totalAmount) >= BigInt(limit.maxTotal)) {
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

  if (limit?.windowMs !== undefined && usages.length > 0) {
    const sorted = [...usages].sort((a, b) => a.usedAt - b.usedAt);
    windowStart = sorted[0].usedAt;
    windowEnd = windowStart + limit.windowMs;
  }

  let totalCount = 0;
  let totalAmount: string | undefined;

  for (const u of usages) {
    if (limit?.windowMs !== undefined && windowStart !== undefined) {
      if (u.usedAt < windowStart || u.usedAt > windowStart + limit.windowMs) {
        continue;
      }
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
