import type {
  LiquidityFeeRecord,
  LiquidityBondVerifyResult,
  RecordLiquidityFeeParams,
  VerifyLiquidityFeeRecordParams,
} from './types.js';

let feeCounter = 0;

export function recordLiquidityFee(params: RecordLiquidityFeeParams): LiquidityFeeRecord {
  const now = params.recordedAt ?? Date.now();
  feeCounter++;
  return {
    feeRecordId: `fee-${now}-${feeCounter}`,
    positionId: params.positionId,
    poolId: params.poolId,
    feeAsset: params.feeAsset,
    grossFeeAmount: params.grossFeeAmount,
    lpFeeAmount: params.lpFeeAmount,
    operatorFeeAmount: params.operatorFeeAmount,
    source: params.source,
    recordedAt: now,
    proofRef: params.proofRef,
    metadata: params.metadata,
  };
}

export function sumFeesForPosition(records: LiquidityFeeRecord[], positionId: string): bigint {
  return records
    .filter((r) => r.positionId === positionId)
    .reduce((sum, r) => sum + r.grossFeeAmount, 0n);
}

export function sumLpFeesForPosition(records: LiquidityFeeRecord[], positionId: string): bigint {
  return records
    .filter((r) => r.positionId === positionId)
    .reduce((sum, r) => sum + (r.lpFeeAmount ?? 0n), 0n);
}

export function verifyLiquidityFeeRecord(params: VerifyLiquidityFeeRecordParams): LiquidityBondVerifyResult {
  const { record, position } = params;

  if (record.positionId !== position.positionId) {
    return { ok: false, reason: 'Fee record position ID does not match', code: 'FEE_RECORD_INVALID' };
  }

  if (record.grossFeeAmount < 0n) {
    return { ok: false, reason: 'Fee amount cannot be negative', code: 'FEE_RECORD_INVALID' };
  }

  return { ok: true, code: 'OK' };
}
