import type {
  LiquidityCommitment,
  LiquidityBondVerifyResult,
  CreateLiquidityCommitmentParams,
  VerifyLiquidityCommitmentParams,
} from './types.js';

let commitmentCounter = 0;

export function createLiquidityCommitment(params: CreateLiquidityCommitmentParams): LiquidityCommitment {
  const now = params.createdAt ?? Date.now();
  commitmentCounter++;
  return {
    commitmentId: `commit-${now}-${commitmentCounter}`,
    poolId: params.poolId,
    lpIdentityId: params.lpIdentityId,
    lpAddress: params.lpAddress,
    asset: params.asset,
    amount: params.amount,
    purpose: params.purpose,
    status: 'draft',
    terms: params.terms,
    createdAt: now,
    expiresAt: params.expiresAt,
    proofRef: params.proofRef,
    metadata: params.metadata,
  };
}

export function acceptLiquidityCommitment(commitment: LiquidityCommitment, now?: number): LiquidityCommitment {
  return { ...commitment, status: 'accepted' };
}

export function rejectLiquidityCommitment(commitment: LiquidityCommitment, reason: string, now?: number): LiquidityCommitment {
  return { ...commitment, status: 'rejected', metadata: { ...commitment.metadata, rejectReason: reason } };
}

export function cancelLiquidityCommitment(commitment: LiquidityCommitment, now?: number): LiquidityCommitment {
  return { ...commitment, status: 'cancelled' };
}

export function verifyLiquidityCommitment(params: VerifyLiquidityCommitmentParams): LiquidityBondVerifyResult {
  const { commitment, pool, now } = params;

  if (commitment.amount <= 0n) {
    return { ok: false, reason: 'Commitment amount must be positive', code: 'AMOUNT_TOO_SMALL' };
  }

  if (pool.minCommitment !== undefined && commitment.amount < pool.minCommitment) {
    return { ok: false, reason: 'Commitment below pool minimum', code: 'AMOUNT_TOO_SMALL' };
  }

  if (pool.maxCommitment !== undefined && commitment.amount > pool.maxCommitment) {
    return { ok: false, reason: 'Commitment exceeds pool maximum', code: 'COMMITMENT_INVALID' };
  }

  if (commitment.asset !== pool.asset) {
    return { ok: false, reason: 'Commitment asset does not match pool asset', code: 'ASSET_NOT_ACCEPTED' };
  }

  const ts = now ?? Date.now();
  if (commitment.expiresAt !== undefined && commitment.expiresAt < ts) {
    return { ok: false, reason: 'Commitment has expired', code: 'COMMITMENT_EXPIRED' };
  }

  return { ok: true, code: 'OK' };
}
