import type {
  LiquidityPosition,
  LiquidityPoolManifest,
  LiquidityBondVerifyResult,
  ComputePositionRiskScoreParams,
  ComputePoolUtilisationParams,
} from './types.js';

export function applyLiquidityHaircut(amount: bigint, haircutBps?: number): bigint {
  if (!haircutBps || haircutBps <= 0) return amount;
  const haircut = (amount * BigInt(haircutBps)) / 10000n;
  const result = amount - haircut;
  return result > 0n ? result : 0n;
}

export function computePositionRiskScore(params: ComputePositionRiskScoreParams): number {
  const { position, pool, now } = params;
  let score = 100;

  if (position.status === 'depleted' || position.status === 'invalid' || position.status === 'expired') {
    return 0;
  }

  if (position.status === 'quiescing') score -= 30;
  if (position.status === 'withdrawal-requested') score -= 20;

  const ts = now ?? Date.now();
  if (position.expiresAt !== undefined) {
    const remaining = position.expiresAt - ts;
    if (remaining < 86400000) score -= 10;
    if (remaining < 3600000) score -= 20;
  }

  if (pool.riskPolicy?.haircutBps && pool.riskPolicy.haircutBps > 1000) score -= 10;

  return Math.max(0, score);
}

export function computePoolUtilisation(params: ComputePoolUtilisationParams): number {
  const { pool, positions } = params;
  if (!pool.totalCapacity || pool.totalCapacity <= 0n) return 0;
  const totalAllocated = positions.reduce((sum, p) => sum + (p.allocatedAmount ?? 0n), 0n);
  return Number((totalAllocated * 10000n) / pool.totalCapacity) / 100;
}

export function detectDoubleCountedLiquidity(positions: LiquidityPosition[]): LiquidityBondVerifyResult {
  const seen = new Map<string, string>();

  for (const pos of positions) {
    const refs = [
      pos.underlyingUtxoRef,
      pos.omniaChannelId,
      pos.factoryId,
      pos.routerId,
      pos.vtxoPoolId,
      pos.statechainId,
      pos.rfqInventoryId,
      pos.merchantSettlementId,
    ].filter((r): r is string => r !== undefined && r !== '');

    for (const ref of refs) {
      if (seen.has(ref)) {
        return {
          ok: false,
          reason: `Underlying reference ${ref} appears in positions ${seen.get(ref)} and ${pos.positionId}`,
          code: 'DOUBLE_COUNTED_LIQUIDITY',
        };
      }
      seen.set(ref, pos.positionId);
    }
  }

  return { ok: true, code: 'OK' };
}
