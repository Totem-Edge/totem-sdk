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
  commitments[commitment.commitmentId] = commitment;
  return { ...state, commitments, updatedAt: Date.now() };
}

export function registerLiquidityPosition(
  state: LiquidityBondRegistryState,
  position: LiquidityPosition
): LiquidityBondRegistryState {
  const positions = { ...state.positions };
  positions[position.positionId] = position;
  return { ...state, positions, updatedAt: Date.now() };
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
  return Object.values(state.positions).filter(
    (p) => p.status === 'active' || p.status === 'allocated' || p.status === 'partially-reserved'
  );
}

export function listWithdrawablePositions(
  state: LiquidityBondRegistryState,
  now: number
): LiquidityPosition[] {
  return Object.values(state.positions).filter((p) => {
    if (p.status === 'depleted' || p.status === 'invalid' || p.status === 'expired') return false;
    if (p.lockTerms.lockType === 'none') return true;
    if (p.lockTerms.earlyWithdrawalAllowed) return true;
    if (p.lockTerms.unlockAfterMs !== undefined) {
      return now >= p.createdAt + p.lockTerms.unlockAfterMs;
    }
    return false;
  });
}
