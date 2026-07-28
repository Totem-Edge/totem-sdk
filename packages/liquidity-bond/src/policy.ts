import type {
  LiquidityBondRegistryState,
  LiquidityBondPolicy,
  LiquidityPosition,
  LiquidityBondVerifyResult,
  ValidateLiquidityAgainstPolicyParams,
} from './types.js';

export function validateLiquidityAgainstPolicy(params: ValidateLiquidityAgainstPolicyParams): LiquidityBondVerifyResult {
  const { position, pool, policy } = params;
  const now = policy.now ?? Date.now();

  if (policy.acceptedAssets && policy.acceptedAssets.length > 0) {
    if (!policy.acceptedAssets.includes(position.asset)) {
      return { ok: false, reason: `Asset ${position.asset} not accepted`, code: 'ASSET_NOT_ACCEPTED' };
    }
  }

  if (policy.acceptedPurposes && policy.acceptedPurposes.length > 0) {
    if (!policy.acceptedPurposes.includes(position.purpose)) {
      return { ok: false, reason: `Purpose ${position.purpose} not accepted`, code: 'ASSET_NOT_ACCEPTED' };
    }
  }

  if (policy.minAmount !== undefined && position.amount < policy.minAmount) {
    return { ok: false, reason: 'Position amount below minimum', code: 'AMOUNT_TOO_SMALL' };
  }

  if (policy.maxHaircutBps !== undefined && pool.riskPolicy?.haircutBps !== undefined) {
    if (pool.riskPolicy.haircutBps > policy.maxHaircutBps) {
      return { ok: false, reason: 'Pool haircut exceeds policy maximum', code: 'ASSET_NOT_ACCEPTED' };
    }
  }

  if (policy.requireIdentity && !position.lpIdentityId && !position.lpAddress) {
    return { ok: false, reason: 'Identity required but not provided', code: 'LP_IDENTITY_NOT_AUTHORISED' };
  }

  if (policy.requireProviderBond && !position.providerBondRef?.providerId) {
    return { ok: false, reason: 'Provider bond required but not provided', code: 'PROVIDER_REF_INVALID' };
  }

  if (policy.minProviderScore !== undefined && position.providerBondRef?.providerScore !== undefined) {
    if (position.providerBondRef.providerScore < policy.minProviderScore) {
      return { ok: false, reason: 'Provider score below minimum', code: 'PROVIDER_REF_INVALID' };
    }
  }

  if (policy.rejectDepleted && position.status === 'depleted') {
    return { ok: false, reason: 'Position is depleted', code: 'POSITION_DEPLETED' };
  }

  if (policy.rejectExpired) {
    if (position.expiresAt !== undefined && position.expiresAt < now) {
      return { ok: false, reason: 'Position has expired', code: 'POSITION_INVALID' };
    }
  }

  if (!policy.allowWithdrawablePositions) {
    if (position.status === 'withdrawal-requested' || position.status === 'quiescing') {
      return { ok: false, reason: 'Position is withdrawable', code: 'WITHDRAWAL_NOT_ALLOWED' };
    }
  }

  return { ok: true, code: 'OK' };
}

export function filterLiquidityPositionsByPolicy(
  state: LiquidityBondRegistryState,
  policy: LiquidityBondPolicy
): LiquidityPosition[] {
  return Object.values(state.positions).filter((position) => {
    const pool = state.pools[position.poolId];
    if (!pool) return false;
    const result = validateLiquidityAgainstPolicy({ position, pool, policy });
    return result.ok;
  });
}

export function rankLiquidityPositionsByRisk(positions: LiquidityPosition[]): LiquidityPosition[] {
  return [...positions].sort((a, b) => {
    const aRisk = a.status === 'active' ? 0 : a.status === 'quiescing' ? 1 : 2;
    const bRisk = b.status === 'active' ? 0 : b.status === 'quiescing' ? 1 : 2;
    if (aRisk !== bRisk) return aRisk - bRisk;
    if (a.amount > b.amount) return -1;
    if (a.amount < b.amount) return 1;
    return 0;
  });
}

export function explainLiquidityPolicyFailure(result: LiquidityBondVerifyResult): string[] {
  if (result.ok) return ['Policy check passed'];
  return [`Failed: ${result.code}`, result.reason ?? 'No reason provided'];
}
