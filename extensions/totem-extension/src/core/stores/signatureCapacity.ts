/**
 * Per-address WOTS signature capacity classification.
 *
 * Each address has a finite signing budget (KEYS_PER_LEVEL * KEYS_PER_LEVEL = 4096
 * one-time signatures by default in v2). Auth (TOTEM_VERIFY) and spend signatures
 * share the same per-address budget, so long-running dApp sessions that re-verify
 * frequently can erode capacity. The wallet warns the user before exhaustion.
 *
 * Levels:
 *   - ok        : < 80%  used
 *   - warning   : >= 80% used (start thinking about rotating addresses)
 *   - critical  : >= 95% used (act soon — only a handful of leaves remain)
 *   - exhausted : 100%   used (no more signatures available for this address)
 */

export const SIGNATURE_CAPACITY_PER_ADDRESS = 64 * 64;

export const SIGNATURE_CAPACITY_THRESHOLDS = {
  warning: 0.8,
  critical: 0.95,
  exhausted: 1.0,
} as const;

export type SignatureCapacityLevel = 'ok' | 'warning' | 'critical' | 'exhausted';

export interface SignatureCapacity {
  used: number;
  total: number;
  remaining: number;
  percentage: number;
  level: SignatureCapacityLevel;
}

export function classifyCapacity(
  used: number,
  total: number = SIGNATURE_CAPACITY_PER_ADDRESS
): SignatureCapacity {
  const safeTotal = total > 0 ? total : SIGNATURE_CAPACITY_PER_ADDRESS;
  const clampedUsed = Math.max(0, Math.min(used, safeTotal));
  const fraction = clampedUsed / safeTotal;
  const percentage = fraction * 100;

  let level: SignatureCapacityLevel = 'ok';
  if (clampedUsed >= safeTotal) {
    level = 'exhausted';
  } else if (fraction >= SIGNATURE_CAPACITY_THRESHOLDS.critical) {
    level = 'critical';
  } else if (fraction >= SIGNATURE_CAPACITY_THRESHOLDS.warning) {
    level = 'warning';
  }

  return {
    used: clampedUsed,
    total: safeTotal,
    remaining: safeTotal - clampedUsed,
    percentage,
    level,
  };
}

export function describeCapacityLevel(level: SignatureCapacityLevel): string {
  switch (level) {
    case 'warning':
      return 'This address has used over 80% of its one-time signatures. Consider rotating to a different address.';
    case 'critical':
      return 'This address is almost out of one-time signatures (95%+ used). Switch to another address or generate a new one before signing again.';
    case 'exhausted':
      return 'This address has no remaining one-time signatures. Switch to another address or generate a new one — it can no longer sign.';
    case 'ok':
    default:
      return '';
  }
}
