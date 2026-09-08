/**
 * omnia-pool/deposit.ts — LP commitment and deposit primitives.
 */

import {
  acceptLiquidityCommitment,
  createLiquidityCommitment,
  createLiquidityPosition,
  issueLiquidityReceipt,
  registerLiquidityCommitment,
  registerLiquidityPosition,
  attachLiquidityReceipt,
  computeEffectiveLiquidityAmount,
  type CreateLiquidityCommitmentParams,
  type LiquidityAsset,
  type LiquidityBondRegistryState,
  type LiquidityCommitment,
  type LiquidityPosition,
  type LiquidityPoolManifest,
  type LiquidityPurpose,
} from '@totemsdk/liquidity-bond';
import type { DepositToPoolResult } from './types.js';

export interface CommitToPoolParams {
  pool: LiquidityPoolManifest;
  lpAddress: string;
  amount: string;
  purpose: LiquidityPurpose;
  lpIdentityId?: string;
  expiresAt?: number;
  proofRef?: unknown;
  metadata?: Record<string, unknown>;
}

export interface AcceptCommitmentParams {
  commitment: LiquidityCommitment;
  pool: LiquidityPoolManifest;
  registry: LiquidityBondRegistryState;
}

export interface DepositToPoolParams {
  pool: LiquidityPoolManifest;
  lpAddress: string;
  amount: string;
  purpose: LiquidityPurpose;
  lpIdentityId?: string;
  underlyingRefs?: {
    underlyingUtxoRef?: string;
    omniaChannelId?: string;
    factoryId?: string;
    routerId?: string;
    vtxoPoolId?: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Create a signed LP commitment for a pool.
 */
export function commitToPool(params: CommitToPoolParams): {
  commitment: LiquidityCommitment;
} {
  const createParams: CreateLiquidityCommitmentParams = {
    poolId: params.pool.poolId,
    lpAddress: params.lpAddress,
    lpIdentityId: params.lpIdentityId,
    asset: params.pool.asset,
    amount: BigInt(params.amount),
    purpose: params.purpose,
    terms: params.pool.lockTerms,
    expiresAt: params.expiresAt,
    proofRef: params.proofRef as never,
    metadata: params.metadata,
  };
  const commitment = createLiquidityCommitment(createParams);
  return { commitment };
}

/**
 * Accept an LP commitment and register it in the pool registry.
 */
export function acceptCommitment(
  params: AcceptCommitmentParams,
): {
  commitment: LiquidityCommitment;
  registry: LiquidityBondRegistryState;
} {
  const accepted = acceptLiquidityCommitment(params.commitment);
  const registry = registerLiquidityCommitment(params.registry, accepted);
  return { commitment: accepted, registry };
}

/**
 * Create and register a `LiquidityPosition` from an accepted commitment.
 */
export function createPositionFromCommitment(
  commitment: LiquidityCommitment,
  pool: LiquidityPoolManifest,
  registry: LiquidityBondRegistryState,
  underlyingRefs?: DepositToPoolParams['underlyingRefs'],
  metadata?: Record<string, unknown>,
): {
  position: LiquidityPosition;
  registry: LiquidityBondRegistryState;
} {
  const effectiveAmount = computeEffectiveLiquidityAmount(
    { amount: commitment.amount } as LiquidityPosition,
    pool.riskPolicy,
  );
  const position = createLiquidityPosition({
    commitment,
    poolId: pool.poolId,
    ...underlyingRefs,
    metadata,
  });
  const adjusted: LiquidityPosition = {
    ...position,
    effectiveAmount,
    availableAmount: effectiveAmount,
  };
  const nextRegistry = registerLiquidityPosition(registry, adjusted);
  return { position: adjusted, registry: nextRegistry };
}

/**
 * Issue a non-custodial LP receipt for a position.
 */
export function issueLpReceipt(
  position: LiquidityPosition,
  pool: LiquidityPoolManifest,
  registry: LiquidityBondRegistryState,
): {
  receipt: import('@totemsdk/liquidity-bond').LiquidityReceipt;
  registry: LiquidityBondRegistryState;
} {
  const receipt = issueLiquidityReceipt({
    position,
    poolId: pool.poolId,
    ownerAddress: position.lpAddress,
    ownerIdentityId: position.lpIdentityId,
  });
  const nextRegistry = attachLiquidityReceipt(registry, receipt);
  const withReceipt: LiquidityPosition = { ...position, receiptId: receipt.receiptId };
  const withReceiptRegistry = registerLiquidityPosition(nextRegistry, withReceipt);
  return { receipt, registry: withReceiptRegistry };
}

/**
 * Full deposit flow: accept commitment, create position, issue receipt.
 */
export function depositToPool(
  params: DepositToPoolParams,
  registry: LiquidityBondRegistryState,
): DepositToPoolResult {
  const { commitment } = commitToPool(params);
  const { commitment: accepted, registry: acceptedRegistry } = acceptCommitment({
    commitment,
    pool: params.pool,
    registry,
  });
  const { position, registry: positionRegistry } = createPositionFromCommitment(
    accepted,
    params.pool,
    acceptedRegistry,
    params.underlyingRefs,
    params.metadata,
  );
  const { receipt, registry: finalRegistry } = issueLpReceipt(
    position,
    params.pool,
    positionRegistry,
  );

  return {
    poolId: params.pool.poolId,
    pool: params.pool,
    position,
    receipt,
    state: finalRegistry,
  };
}
