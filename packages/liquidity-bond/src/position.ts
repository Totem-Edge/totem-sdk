import type {
  LiquidityPosition,
  LiquidityBondVerifyResult,
  LiquidityRiskPolicy,
  CreateLiquidityPositionParams,
  VerifyLiquidityPositionParams,
} from './types.js';

let positionCounter = 0;

export function createLiquidityPosition(params: CreateLiquidityPositionParams): LiquidityPosition {
  const now = params.createdAt ?? Date.now();
  positionCounter++;
  const funding = params.funding ?? params.commitment.funding;
  // The position's amount comes from the VERIFIED funding proof, never from the
  // self-declared commitment.amount — an attacker must prove real coins on-chain.
  const chainConfirmed = funding?.status === 'chain-confirmed';
  const amount = chainConfirmed && funding ? funding.amount : params.commitment.amount;
  return {
    positionId: `pos-${now}-${positionCounter}`,
    commitmentId: params.commitment.commitmentId,
    poolId: params.poolId,
    lpIdentityId: params.commitment.lpIdentityId,
    lpAddress: params.commitment.lpAddress,
    providerBondRef: params.providerBondRef,
    asset: params.commitment.asset,
    amount,
    effectiveAmount: amount,
    purpose: params.commitment.purpose,
    status: funding ? 'committed' : 'active',
    lockTerms: params.commitment.terms,
    allocatedAmount: 0n,
    reservedAmount: 0n,
    availableAmount: amount,
    funding,
    omniaChannelId: params.omniaChannelId,
    factoryId: params.factoryId,
    routerId: params.routerId,
    vtxoPoolId: params.vtxoPoolId,
    statechainId: params.statechainId,
    rfqInventoryId: params.rfqInventoryId,
    merchantSettlementId: params.merchantSettlementId,
    createdAt: now,
    expiresAt: params.expiresAt,
    metadata: params.metadata,
  };
}

/**
 * Activate a position only after its funding is chain-confirmed. A position
 * whose proof is merely declared/signed must not reach active liquidity — that
 * is the phantom-deposit seam.
 */
export function activateLiquidityPosition(position: LiquidityPosition, now?: number): LiquidityPosition {
  if (position.funding && position.funding.status !== 'chain-confirmed') {
    throw new Error(
      position.funding.status === 'invalid'
        ? 'cannot activate a position with invalid funding'
        : 'cannot activate a position whose funding is not chain-confirmed',
    );
  }
  return { ...position, status: 'active', updatedAt: now ?? Date.now() };
}

export function markLiquidityPositionQuiescing(position: LiquidityPosition, now?: number): LiquidityPosition {
  return { ...position, status: 'quiescing', updatedAt: now ?? Date.now() };
}

export function markLiquidityPositionDepleted(position: LiquidityPosition, now?: number): LiquidityPosition {
  return { ...position, status: 'depleted', updatedAt: now ?? Date.now() };
}

export function markLiquidityPositionInvalid(position: LiquidityPosition, reason: string, now?: number): LiquidityPosition {
  return { ...position, status: 'invalid', updatedAt: now ?? Date.now(), metadata: { ...position.metadata, invalidReason: reason } };
}

export function computeAvailableLiquidity(position: LiquidityPosition): bigint {
  const allocated = position.allocatedAmount ?? 0n;
  const reserved = position.reservedAmount ?? 0n;
  const used = allocated > reserved ? allocated : reserved;
  const available = position.amount - used;
  return available > 0n ? available : 0n;
}

export function computeEffectiveLiquidityAmount(position: LiquidityPosition, riskPolicy?: LiquidityRiskPolicy): bigint {
  const haircutBps = riskPolicy?.haircutBps ?? 0;
  if (haircutBps <= 0) return position.amount;
  const haircut = (position.amount * BigInt(haircutBps)) / 10000n;
  const effective = position.amount - haircut;
  return effective > 0n ? effective : 0n;
}

export function verifyLiquidityPosition(params: VerifyLiquidityPositionParams): LiquidityBondVerifyResult {
  const { position, pool, now } = params;

  if (position.amount <= 0n) {
    return { ok: false, reason: 'Position amount must be positive', code: 'POSITION_INVALID' };
  }

  if (position.status === 'depleted') {
    return { ok: false, reason: 'Position is depleted', code: 'POSITION_DEPLETED' };
  }

  if (position.status === 'invalid') {
    return { ok: false, reason: 'Position is invalid', code: 'POSITION_INVALID' };
  }

  if (position.status === 'expired') {
    return { ok: false, reason: 'Position has expired', code: 'POSITION_INVALID' };
  }

  const ts = now ?? Date.now();
  if (position.expiresAt !== undefined && position.expiresAt < ts) {
    return { ok: false, reason: 'Position has expired', code: 'POSITION_INVALID' };
  }

  if (position.asset !== pool.asset) {
    return { ok: false, reason: 'Position asset does not match pool asset', code: 'ASSET_NOT_ACCEPTED' };
  }

  return { ok: true, code: 'OK' };
}
