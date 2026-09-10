/**
 * omnia-pool/nav.ts — NAV, utilisation, and risk aggregation primitives.
 */

import {
  computePoolUtilisation,
  computePositionRiskScore,
  type LiquidityBondRegistryState,
  type LiquidityPoolManifest,
  type LiquidityPosition,
} from '@totemsdk/liquidity-bond';
import type { PoolNAV } from './types.js';

/**
 * Compute the net asset value of a pool from its registry state.
 *
 * NAV is the number PIPE broadcasts as POOL_NAV, so it must be spoof-proof:
 * only positions whose funding is chain-confirmed contribute, and only fee
 * records whose earnings are verified (or non-earnable adjustments) accrue.
 * An optional `filter` narrows which positions contribute further.
 */
export function computePoolNAV(
  pool: LiquidityPoolManifest,
  registry: LiquidityBondRegistryState,
  filter?: (position: LiquidityPosition) => boolean,
): PoolNAV {
  const positions = Object.values(registry.positions).filter(
    (p) =>
      p.poolId === pool.poolId &&
      p.funding?.status === 'chain-confirmed' &&
      (filter ? filter(p) : true),
  );
  const records = positions.flatMap((p) => registry.feeRecords[p.positionId] ?? []);

  let totalCommitted = 0n;
  let totalAllocated = 0n;
  let totalReserved = 0n;
  let totalAvailable = 0n;

  for (const pos of positions) {
    totalCommitted += pos.amount;
    totalAllocated += pos.allocatedAmount ?? 0n;
    totalReserved += pos.reservedAmount ?? 0n;
    totalAvailable += pos.availableAmount ?? 0n;
  }

  const accruedFees = records
    .filter((r) => r.source === 'manual-adjustment' || r.verified === true)
    .reduce((sum, r) => sum + (r.lpFeeAmount ?? 0n), 0n);
  const nav = totalCommitted + accruedFees;

  return {
    totalCommitted,
    totalAllocated,
    totalReserved,
    totalAvailable,
    accruedFees,
    nav,
  };
}

/**
 * Compute aggregate pool risk score as the average of active position scores.
 */
export function computePoolRiskScore(
  pool: LiquidityPoolManifest,
  registry: LiquidityBondRegistryState,
): number {
  const positions = Object.values(registry.positions).filter(
    (p) => p.poolId === pool.poolId &&
      p.status !== 'withdrawn' &&
      p.status !== 'depleted' &&
      p.status !== 'invalid',
  );
  if (positions.length === 0) return 100;

  const sum = positions.reduce((acc, pos) => acc + computePositionRiskScore({ position: pos, pool }), 0);
  return Math.round(sum / positions.length);
}
