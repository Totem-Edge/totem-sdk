import { feeEvidenceKey } from './fees.js';
import type {
  LiquidityBondRegistryState,
  LiquidityPoolManifest,
  LiquidityCommitment,
  LiquidityPosition,
  LiquidityReceipt,
  LiquidityAllocation,
  LiquidityFeeRecord,
  WithdrawalIntent,
} from './types.js';

export function createEmptyLiquidityBondRegistryState(): LiquidityBondRegistryState {
  return {
    pools: {},
    commitments: {},
    positions: {},
    receipts: {},
    allocations: {},
    feeRecords: {},
    withdrawals: {},
    feePayouts: {},
    fundingClaims: {},
    updatedAt: Date.now(),
  };
}

export function registerLiquidityPool(
  state: LiquidityBondRegistryState,
  pool: LiquidityPoolManifest
): LiquidityBondRegistryState {
  const pools = { ...state.pools };
  pools[pool.poolId] = pool;
  return { ...state, pools, updatedAt: Date.now() };
}

export function updateLiquidityPool(
  state: LiquidityBondRegistryState,
  pool: LiquidityPoolManifest
): LiquidityBondRegistryState {
  return registerLiquidityPool(state, pool);
}

export function registerLiquidityCommitment(
  state: LiquidityBondRegistryState,
  commitment: LiquidityCommitment
): LiquidityBondRegistryState {
  const commitments = { ...state.commitments };
  const fundingClaims = { ...(state.fundingClaims ?? {}) };
  const ref = commitment.funding?.utxoRef?.replace(/^0x/i, '').toLowerCase();

  // OMN-033: a funding coin may back at most one active commitment. Rejected,
  // expired and cancelled commitments release their claim.
  if (ref) {
    const existingId = fundingClaims[ref];
    const existing = existingId ? commitments[existingId] : undefined;
    const released = !existing
      || existing.status === 'rejected'
      || existing.status === 'expired'
      || existing.status === 'cancelled';
    if (!released && existingId !== commitment.commitmentId) {
      throw new Error(`funding coin ${commitment.funding!.utxoRef} is already committed by ${existingId}`);
    }
    fundingClaims[ref] = commitment.commitmentId;
  }

  commitments[commitment.commitmentId] = commitment;
  return { ...state, commitments, fundingClaims, updatedAt: Date.now() };
}

export function registerLiquidityPosition(
  state: LiquidityBondRegistryState,
  position: LiquidityPosition
): LiquidityBondRegistryState {
  // OMN-111: one commitment backs at most one position. A retry must return the
  // existing position instead of minting a second liability.
  const existing = position.commitmentId
    ? findPositionByCommitment(state, position.commitmentId)
    : undefined;
  if (existing && existing.positionId !== position.positionId) {
    throw new Error(
      `commitment ${position.commitmentId} already backs position ${existing.positionId}`,
    );
  }
  const positions = { ...state.positions };
  positions[position.positionId] = position;
  return { ...state, positions, updatedAt: Date.now() };
}

/** OMN-111: the position derived from a commitment, if one exists. */
export function findPositionByCommitment(
  state: LiquidityBondRegistryState,
  commitmentId: string
): LiquidityPosition | undefined {
  return Object.values(state.positions).find((p) => p.commitmentId === commitmentId);
}

export function attachLiquidityReceipt(
  state: LiquidityBondRegistryState,
  receipt: LiquidityReceipt
): LiquidityBondRegistryState {
  const receipts = { ...state.receipts };
  receipts[receipt.receiptId] = receipt;
  return { ...state, receipts, updatedAt: Date.now() };
}

export function attachLiquidityAllocation(
  state: LiquidityBondRegistryState,
  allocation: LiquidityAllocation
): LiquidityBondRegistryState {
  const allocations = { ...state.allocations };
  const existing = allocations[allocation.positionId] ?? [];
  allocations[allocation.positionId] = [...existing, allocation];
  return { ...state, allocations, updatedAt: Date.now() };
}

export function attachLiquidityFeeRecord(
  state: LiquidityBondRegistryState,
  record: LiquidityFeeRecord
): LiquidityBondRegistryState {
  // OMN-125: evidence is consumed exactly once. Re-submitting the same
  // earn-proof for the same position would inflate recorded earnings.
  const key = feeEvidenceKey(record);
  if (key !== null) {
    const duplicate = Object.values(state.feeRecords)
      .flat()
      .some((existingRecord) => feeEvidenceKey(existingRecord) === key);
    if (duplicate) {
      throw new Error(`fee earn-proof already recorded for position ${record.positionId}`);
    }
  }
  const feeRecords = { ...state.feeRecords };
  const existing = feeRecords[record.positionId] ?? [];
  feeRecords[record.positionId] = [...existing, record];
  return { ...state, feeRecords, updatedAt: Date.now() };
}

export function attachWithdrawalIntent(
  state: LiquidityBondRegistryState,
  intent: WithdrawalIntent
): LiquidityBondRegistryState {
  const withdrawals = { ...state.withdrawals };
  const existing = withdrawals[intent.positionId] ?? [];
  withdrawals[intent.positionId] = [...existing, intent];
  return { ...state, withdrawals, updatedAt: Date.now() };
}

export function getLiquidityPool(
  state: LiquidityBondRegistryState,
  poolId: string
): LiquidityPoolManifest | undefined {
  return state.pools[poolId];
}

export function getLiquidityPosition(
  state: LiquidityBondRegistryState,
  positionId: string
): LiquidityPosition | undefined {
  return state.positions[positionId];
}

export function getLiquidityReceipt(
  state: LiquidityBondRegistryState,
  receiptId: string
): LiquidityReceipt | undefined {
  return state.receipts[receiptId];
}

export function listLiquidityPools(state: LiquidityBondRegistryState): LiquidityPoolManifest[] {
  return Object.values(state.pools);
}

export function listPositionsByPool(
  state: LiquidityBondRegistryState,
  poolId: string
): LiquidityPosition[] {
  return Object.values(state.positions).filter((p) => p.poolId === poolId);
}

export function listPositionsByLp(
  state: LiquidityBondRegistryState,
  lpAddress: string
): LiquidityPosition[] {
  return Object.values(state.positions).filter((p) => p.lpAddress === lpAddress);
}

export function listActivePositions(state: LiquidityBondRegistryState): LiquidityPosition[] {
  // OMN-110: active liquidity requires chain-confirmed funding.
  return Object.values(state.positions).filter(
    (p) =>
      p.funding?.status === 'chain-confirmed' &&
      (p.status === 'active' || p.status === 'allocated' || p.status === 'partially-reserved'),
  );
}

/**
 * Withdrawable means the holder can pull real funded liquidity. A position whose
 * funding is not chain-confirmed must never appear — a phantom position must not
 * be withdrawable.
 */
export function listWithdrawablePositions(
  state: LiquidityBondRegistryState,
  now: number
): LiquidityPosition[] {
  return Object.values(state.positions).filter((p) => {
    // OMN-110: absent funding is not evidence — never withdrawable.
    if (p.funding?.status !== 'chain-confirmed') return false;
    if (p.status === 'depleted' || p.status === 'invalid' || p.status === 'expired') return false;
    if (p.lockTerms.lockType === 'none') return true;
    if (p.lockTerms.earlyWithdrawalAllowed) return true;
    if (p.lockTerms.unlockAfterMs !== undefined) {
      return now >= p.createdAt + p.lockTerms.unlockAfterMs;
    }
    return false;
  });
}
