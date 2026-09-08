import type {
  LiquidityAsset,
  LiquidityCommitment,
  LiquidityBondVerifyResult,
  CreateLiquidityCommitmentParams,
  VerifyLiquidityCommitmentParams,
} from './types.js';

/** Map a pool asset to the on-chain token id a funding check should match. */
export function assetToTokenId(asset: LiquidityAsset): string {
  return asset === 'MINIMA' ? '0x00' : asset.toLowerCase() === 'usdt' ? '0xUSDT' : asset;
}

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
    status: 'signed',
    terms: params.terms,
    createdAt: now,
    expiresAt: params.expiresAt,
    proofRef: params.proofRef,
    funding: params.funding,
    metadata: params.metadata,
  };
}

/**
 * Accept a commitment. Only a commitment whose funding is chain-confirmed is
 * acceptable — a draft/signed commitment has only self-declared funding. When
 * `chainProvider` and a confirmed funding are passed in, the on-chain gate is
 * re-checked here; otherwise acceptance refuses the phantom-deposit path.
 */
export async function acceptLiquidityCommitment(
  commitment: LiquidityCommitment,
  opts?: { chainProvider?: import('./types.js').LiquidityChainFundingVerifier; now?: number },
): Promise<LiquidityCommitment> {
  if (commitment.funding?.status !== 'chain-confirmed') {
    throw new Error(
      commitment.funding?.status === 'invalid'
        ? 'cannot accept a commitment with invalid funding'
        : 'cannot accept a commitment whose funding is not chain-confirmed',
    );
  }
  if (opts?.chainProvider) {
    const verified = await opts.chainProvider.verifyDeposit({
      coinId: commitment.funding.utxoRef,
      ownerAddress: commitment.lpAddress,
      tokenId: assetToTokenId(commitment.asset),
      claimedAmount: commitment.amount.toString(),
    });
    if (!verified.valid) {
      throw new Error(`cannot accept a commitment whose funding failed on-chain verification: ${verified.reason ?? 'unknown reason'}`);
    }
  }
  return { ...commitment, status: 'accepted' };
}

export function rejectLiquidityCommitment(commitment: LiquidityCommitment, reason: string, now?: number): LiquidityCommitment {
  return { ...commitment, status: 'rejected', metadata: { ...commitment.metadata, rejectReason: reason } };
}

export function cancelLiquidityCommitment(commitment: LiquidityCommitment, now?: number): LiquidityCommitment {
  return { ...commitment, status: 'cancelled' };
}

export function verifyLiquidityCommitment(params: VerifyLiquidityCommitmentParams): Promise<LiquidityBondVerifyResult> {
  return doVerifyLiquidityCommitment(params);
}

async function doVerifyLiquidityCommitment(
  params: VerifyLiquidityCommitmentParams,
): Promise<LiquidityBondVerifyResult> {
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

  if (commitment.funding) {
    if (commitment.funding.status === 'invalid') {
      return { ok: false, reason: 'Commitment funding was invalidated on-chain', code: 'COMMITMENT_INVALID' };
    }
    if (commitment.funding.status !== 'chain-confirmed') {
      if (!params.chainProvider) {
        return {
          ok: false,
          reason: 'Commitment funding requires a live on-chain verifier',
          code: 'REQUIRES_LIVE_VERIFIER',
          requiresLiveVerifier: true,
        };
      }
      const verified = await params.chainProvider.verifyDeposit({
        coinId: commitment.funding.utxoRef,
        ownerAddress: commitment.lpAddress,
        tokenId: assetToTokenId(commitment.asset),
        claimedAmount: commitment.amount.toString(),
      });
      if (!verified.valid) {
        return {
          ok: false,
          reason: `Commitment funding failed on-chain verification: ${verified.reason ?? 'unknown reason'}`,
          code: 'REQUIRES_LIVE_VERIFIER',
          requiresLiveVerifier: true,
        };
      }
    }
  } else if (params.chainProvider) {
    return {
      ok: false,
      reason: 'Commitment carries no funding to verify',
      code: 'COMMITMENT_INVALID',
    };
  }

  return { ok: true, code: 'OK' };
}

/**
 * Confirm a commitment's funding on-chain and mark it chain-confirmed. Returns
 * REQUIRES_LIVE_VERIFIER when no funding/verifier is present so the caller can
 * refuse to proceed rather than trusting a declared string.
 */
export async function confirmLiquidityCommitment(
  commitment: LiquidityCommitment,
  chainProvider: import('./types.js').LiquidityChainFundingVerifier,
  now?: number,
): Promise<LiquidityCommitment> {
  if (!commitment.funding) {
    throw new Error('commitment carries no funding to confirm');
  }
  const verified = await chainProvider.verifyDeposit({
    coinId: commitment.funding.utxoRef,
    ownerAddress: commitment.lpAddress,
    tokenId: assetToTokenId(commitment.asset),
    claimedAmount: commitment.amount.toString(),
  });
  if (!verified.valid) {
    return { ...commitment, funding: { ...commitment.funding, status: 'invalid' } };
  }
  return {
    ...commitment,
    funding: { ...commitment.funding, status: 'chain-confirmed', confirmedAt: now ?? Date.now() },
  };
}
