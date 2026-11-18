import type {
  EarnableFeeSource,
  FeePayoutRef,
  LiquidityBondRegistryState,
  LiquidityFeeRecord,
  LiquidityBondVerifyResult,
  PayoutSettlementEvidence,
  PayoutSettlementVerifier,
  RecordLiquidityFeeParams,
  SettledFeePayout,
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

/** Stable key for a payout reference (payoutId + nonce are both required). */
export function computeFeePayoutKey(ref: Pick<FeePayoutRef, 'payoutId' | 'nonce'>): string {
  return `${ref.payoutId}:${ref.nonce}`;
}

/** Look up a registered settled payout without consuming it. */
export function getSettledFeePayout(
  registry: LiquidityBondRegistryState,
  ref: Pick<FeePayoutRef, 'payoutId' | 'nonce'>,
): SettledFeePayout | undefined {
  return registry.feePayouts?.[computeFeePayoutKey(ref)];
}

export interface RegisterSettledFeePayoutParams {
  payoutRef: FeePayoutRef;
  positionId: string;
  poolId: string;
  /** Amount actually paid to the LP, in atoms. */
  amount: bigint;
  settlement: PayoutSettlementEvidence;
  /**
   * Required: verifies the settlement against a real evidence source. Absent or
   * failing verification means the payout is never recorded (fail closed).
   */
  verifier: PayoutSettlementVerifier;
}

/**
 * Record a payout as settled, bound to the exact position, pool, LP and amount.
 * Registration requires a live settlement verifier: an unverified reference can
 * never become a payout that a fee claim/compound is allowed to release. The
 * reference is unique — a reused payoutId/nonce is rejected.
 */
export async function registerSettledFeePayout(
  registry: LiquidityBondRegistryState,
  params: RegisterSettledFeePayoutParams,
): Promise<{ registry: LiquidityBondRegistryState; payout: SettledFeePayout }> {
  const { payoutRef, settlement, verifier } = params;
  if (!payoutRef?.payoutId || !payoutRef?.nonce) {
    throw new Error('a settled fee payout requires both a payoutId and a nonce');
  }
  if (!settlement || typeof settlement.evidenceRef !== 'string' || settlement.evidenceRef.length === 0) {
    throw new Error('a settled fee payout requires a settlement evidenceRef');
  }
  if (!verifier || typeof verifier.verifySettlement !== 'function') {
    throw new Error('a settled fee payout requires a settlement verifier (no unverified payout may back a claim)');
  }
  const position = registry.positions[params.positionId];
  if (!position) {
    throw new Error(`position ${params.positionId} is not registered`);
  }
  if (position.poolId !== params.poolId) {
    throw new Error(`position ${params.positionId} does not belong to pool ${params.poolId}`);
  }
  if (params.amount <= 0n) {
    throw new Error('a settled fee payout amount must be positive');
  }

  const key = computeFeePayoutKey(payoutRef);
  if (registry.feePayouts?.[key]) {
    throw new Error(`payoutRef ${key} is already registered as a settled payout`);
  }
  // One settlement can back exactly one payout: replaying the same evidence
  // under a fresh payoutId/nonce would mint a second entitlement.
  const replay = Object.values(registry.feePayouts ?? {}).find(
    (existing) => existing.evidenceRef === settlement.evidenceRef,
  );
  if (replay) {
    throw new Error(
      `settlement evidence ${settlement.evidenceRef} already backs payoutRef ${computeFeePayoutKey(replay)}`,
    );
  }

  const verdict = await verifier.verifySettlement({
    settlement,
    poolId: params.poolId,
    positionId: params.positionId,
    recipientAddress: position.lpAddress,
    amount: params.amount,
  });
  if (!verdict || verdict.valid !== true) {
    throw new Error(`fee payout settlement not verified: ${verdict?.reason ?? 'unknown'}`);
  }

  const payout: SettledFeePayout = {
    payoutId: payoutRef.payoutId,
    nonce: payoutRef.nonce,
    kind: payoutRef.kind,
    positionId: params.positionId,
    poolId: params.poolId,
    amount: params.amount,
    evidenceRef: settlement.evidenceRef,
    settlementStatus: settlement.status,
    settledAt: Date.now(),
  };
  return {
    payout,
    registry: {
      ...registry,
      feePayouts: { ...(registry.feePayouts ?? {}), [key]: payout },
      updatedAt: Date.now(),
    },
  };
}

/**
 * Validate that a payout reference is a known, unconsumed, correctly bound
 * settled payout — without consuming it. Unknown, mismatched and reused
 * references are rejected.
 */
export function assertSettledFeePayoutUsable(
  registry: LiquidityBondRegistryState,
  ref: FeePayoutRef,
  binding: { positionId: string; poolId: string },
): SettledFeePayout {
  const key = computeFeePayoutKey(ref);
  const payout = registry.feePayouts?.[key];
  if (!payout) {
    throw new Error(`unknown payoutRef ${key}: no settled payout is recorded for this reference`);
  }
  if (payout.kind !== ref.kind) {
    throw new Error(`payoutRef ${key} kind ${ref.kind} does not match the settled payout kind ${payout.kind}`);
  }
  if (payout.positionId !== binding.positionId) {
    throw new Error(`payoutRef ${key} is bound to position ${payout.positionId}, not ${binding.positionId}`);
  }
  if (payout.poolId !== binding.poolId) {
    throw new Error(`payoutRef ${key} is bound to pool ${payout.poolId}, not ${binding.poolId}`);
  }
  if (payout.consumedBy || payout.consumedAt !== undefined) {
    throw new Error(`payoutRef ${key} has already been consumed by ${payout.consumedBy ?? 'an earlier claim'}`);
  }
  return payout;
}

/**
 * Consume a settled payout for a fee claim/compound. Unknown references,
 * references bound to another position/pool, and already-consumed references
 * are rejected — a payout is single-use and cannot release fees twice.
 */
export function consumeSettledFeePayout(
  registry: LiquidityBondRegistryState,
  ref: FeePayoutRef,
  binding: { positionId: string; poolId: string; amount: bigint; consumedBy: string },
): LiquidityBondRegistryState {
  const key = computeFeePayoutKey(ref);
  const payout = assertSettledFeePayoutUsable(registry, ref, binding);
  if (binding.amount <= 0n) {
    throw new Error('a claim or compound must release a positive amount');
  }
  if (binding.amount > payout.amount) {
    throw new Error(`claim amount ${binding.amount} exceeds settled payout amount ${payout.amount}`);
  }

  const consumed: SettledFeePayout = {
    ...payout,
    consumedBy: binding.consumedBy,
    consumedAt: Date.now(),
  };
  return {
    ...registry,
    feePayouts: { ...(registry.feePayouts ?? {}), [key]: consumed },
    updatedAt: Date.now(),
  };
}
