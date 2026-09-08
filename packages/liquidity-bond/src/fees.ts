import type {
  EarnableFeeSource,
  LiquidityFeeRecord,
  LiquidityBondVerifyResult,
  RecordLiquidityFeeParams,
  VerifyLiquidityFeeRecordParams,
} from './types.js';

let feeCounter = 0;

const EANABLE_SOURCES: ReadonlySet<string> = new Set(['route-fee', 'rfq-spread', 'merchant-fee']);

export function isEarnableSource(source: string): source is EarnableFeeSource {
  return EANABLE_SOURCES.has(source);
}

export function recordLiquidityFee(params: RecordLiquidityFeeParams): LiquidityFeeRecord {
  const now = params.recordedAt ?? Date.now();
  feeCounter++;

  if (isEarnableSource(params.source) && params.earnProof === undefined) {
    throw new Error(`fee source ${params.source} requires an earn-proof (payment proof)`);
  }

  const lp = params.lpFeeAmount ?? 0n;
  const operator = params.operatorFeeAmount ?? 0n;
  if (lp + operator > params.grossFeeAmount) {
    throw new Error('lpFee + operatorFee must not exceed gross fee amount');
  }

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
    earnProof: params.earnProof,
    verified: params.verified,
    payoutRef: params.payoutRef,
    metadata: params.metadata,
  };
}

export function sumFeesForPosition(records: LiquidityFeeRecord[], positionId: string): bigint {
  return records
    .filter((r) => r.positionId === positionId)
    .reduce((sum, r) => sum + r.grossFeeAmount, 0n);
}

/**
 * Sum LP fees for a position, counting only records whose earnings are
 * verified (or non-earnable adjustments). An unverified earnable record must
 * never inflate an LP's entitlement.
 */
export function sumLpFeesForPosition(records: LiquidityFeeRecord[], positionId: string): bigint {
  return records
    .filter((r) => r.positionId === positionId)
    .filter((r) => !isEarnableSource(r.source) || r.verified === true)
    .reduce((sum, r) => sum + (r.lpFeeAmount ?? 0n), 0n);
}

export async function verifyLiquidityFeeRecord(
  params: VerifyLiquidityFeeRecordParams,
): Promise<LiquidityBondVerifyResult> {
  const { record, position } = params;

  if (record.positionId !== position.positionId) {
    return { ok: false, reason: 'Fee record position ID does not match', code: 'FEE_RECORD_INVALID' };
  }

  if (record.grossFeeAmount < 0n) {
    return { ok: false, reason: 'Fee amount cannot be negative', code: 'FEE_RECORD_INVALID' };
  }

  if (isEarnableSource(record.source)) {
    if (!record.earnProof && !record.proofRef) {
      return { ok: false, reason: 'Earnable fee record carries no earn-proof', code: 'FEE_RECORD_INVALID' };
    }
    if (!params.feeProofVerifier) {
      return {
        ok: false,
        reason: 'Earnable fee record requires a live fee-proof verifier',
        code: 'REQUIRES_LIVE_VERIFIER',
        requiresLiveVerifier: true,
      };
    }
    const verified = await params.feeProofVerifier.verifyFeeProof({
      source: record.source,
      proof: record.earnProof ?? record.proofRef,
      positionId: record.positionId,
      poolId: record.poolId,
      grossAmount: record.grossFeeAmount,
    });
    if (!verified.valid) {
      return { ok: false, reason: `Fee earn-proof failed: ${verified.reason ?? 'unknown'}`, code: 'FEE_RECORD_INVALID' };
    }
  }

  return { ok: true, code: 'OK' };
}
