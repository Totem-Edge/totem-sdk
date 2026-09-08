/**
 * omnia-pool/fees.ts — Fee recording, claiming, and compounding primitives.
 */

import {
  attachLiquidityFeeRecord,
  computePoolUtilisation,
  recordLiquidityFee,
  sumLpFeesForPosition,
  type FeeSource,
  type LiquidityBondRegistryState,
  type LiquidityFeeRecord,
  type LiquidityPoolManifest,
  type LiquidityPosition,
} from '@totemsdk/liquidity-bond';
import type { ClaimFeesOptions, CompoundFeesOptions, OmniaPoolFeeRecord, RecordPoolFeeParams } from './types.js';

function splitFee(
  gross: bigint,
  lpBps: number,
  operatorBps: number,
): { lp: bigint; operator: bigint } {
  const lp = (gross * BigInt(lpBps)) / 10000n;
  const operator = (gross * BigInt(operatorBps)) / 10000n;
  return { lp, operator };
}

/**
 * Record a fee against a pool position, splitting between LP and operator.
 */
export function recordPoolFee(
  params: RecordPoolFeeParams,
  registry: LiquidityBondRegistryState,
): {
  feeRecord: LiquidityFeeRecord;
  registry: LiquidityBondRegistryState;
} {
  const gross = BigInt(params.grossAmount);
  const policy = params.pool.feePolicy;
  const lpBps = policy?.lpFeeBps ?? 0;
  const operatorBps = policy?.operatorFeeBps ?? 0;
  const { lp, operator } = splitFee(gross, lpBps, operatorBps);

  const feeRecord = recordLiquidityFee({
    positionId: params.position.positionId,
    poolId: params.pool.poolId,
    feeAsset: params.pool.asset,
    grossFeeAmount: gross,
    lpFeeAmount: lp,
    operatorFeeAmount: operator,
    source: params.source,
    earnProof: params.earnProof,
    verified: params.verified,
    metadata: params.metadata,
  });

  const nextRegistry = attachLiquidityFeeRecord(registry, feeRecord);
  return { feeRecord, registry: nextRegistry };
}

/**
 * Compute the total unclaimed LP fee entitlement for a position.
 */
export function computeUnclaimedFees(
  position: LiquidityPosition,
  registry: LiquidityBondRegistryState,
): bigint {
  const records = registry.feeRecords[position.positionId] ?? [];
  return sumLpFeesForPosition(records, position.positionId);
}

/**
 * Claim accrued LP fees. The claim is bound to a settled payout (`payoutRef`):
 * the LP fee balance is only reduced once a real payout (VTXO mint / channel
 * settlement) exists — preventing "claim then fail to pay" and double-claim.
 */
export function claimFees(
  pool: LiquidityPoolManifest,
  position: LiquidityPosition,
  registry: LiquidityBondRegistryState,
  opts: ClaimFeesOptions,
): {
  claimedAmount: bigint;
  registry: LiquidityBondRegistryState;
} {
  if (!opts.payoutRef) {
    throw new Error('claimFees requires a payoutRef (settled payout) to bind the claim to');
  }
  const unclaimed = computeUnclaimedFees(position, registry);
  const requested = opts.amount ? BigInt(opts.amount) : unclaimed;
  if (requested > unclaimed) {
    throw new Error('claim amount exceeds unclaimed fees');
  }

  const feeRecord = recordLiquidityFee({
    positionId: position.positionId,
    poolId: pool.poolId,
    feeAsset: pool.asset,
    grossFeeAmount: 0n,
    lpFeeAmount: -requested,
    operatorFeeAmount: 0n,
    source: 'manual-adjustment',
    payoutRef: opts.payoutRef,
    metadata: {
      action: 'claim',
      recipientAddress: opts.recipientAddress,
    },
  });

  const nextRegistry = attachLiquidityFeeRecord(registry, feeRecord);
  return { claimedAmount: requested, registry: nextRegistry };
}

/**
 * Compound accrued LP fees back into the position's principal. Like claims,
 * compounding is bound to a settled payout so the entitlement is only zeroed
 * against a real execution.
 */
export function compoundFees(
  pool: LiquidityPoolManifest,
  position: LiquidityPosition,
  registry: LiquidityBondRegistryState,
  opts: CompoundFeesOptions,
): {
  compoundedAmount: bigint;
  position: LiquidityPosition;
  registry: LiquidityBondRegistryState;
} {
  if (!opts.payoutRef) {
    throw new Error('compoundFees requires a payoutRef (settled payout) to bind the compound to');
  }
  const unclaimed = computeUnclaimedFees(position, registry);
  if (unclaimed <= 0n) {
    return { compoundedAmount: 0n, position, registry };
  }

  const feeRecord = recordLiquidityFee({
    positionId: position.positionId,
    poolId: pool.poolId,
    feeAsset: pool.asset,
    grossFeeAmount: 0n,
    lpFeeAmount: -unclaimed,
    operatorFeeAmount: 0n,
    source: 'manual-adjustment',
    payoutRef: opts.payoutRef,
    metadata: { action: 'compound' },
  });

  const feeReg = attachLiquidityFeeRecord(registry, feeRecord);

  const newAmount = position.amount + unclaimed;
  const updatedPosition: LiquidityPosition = {
    ...position,
    amount: newAmount,
    effectiveAmount: (position.effectiveAmount ?? position.amount) + unclaimed,
    availableAmount: (position.availableAmount ?? 0n) + unclaimed,
    updatedAt: Date.now(),
  };

  const positions = { ...feeReg.positions };
  positions[position.positionId] = updatedPosition;
  const nextRegistry: LiquidityBondRegistryState = {
    ...feeReg,
    positions,
    updatedAt: Date.now(),
  };

  return { compoundedAmount: unclaimed, position: updatedPosition, registry: nextRegistry };
}

/**
 * Get pool utilisation from the liquidity-bond registry.
 */
export function getUtilisation(
  pool: LiquidityPoolManifest,
  registry: LiquidityBondRegistryState,
): number {
  const positions = Object.values(registry.positions).filter((p) => p.poolId === pool.poolId);
  return computePoolUtilisation({ pool, positions });
}

/**
 * Convenience: record a fee and return the `OmniaPoolFeeRecord` view.
 */
export function toOmniaPoolFeeRecord(record: LiquidityFeeRecord): OmniaPoolFeeRecord {
  return {
    feeRecordId: record.feeRecordId,
    positionId: record.positionId,
    source: record.source,
    amount: record.grossFeeAmount.toString(),
    tokenId: record.feeAsset,
    recordedAt: record.recordedAt,
  };
}
