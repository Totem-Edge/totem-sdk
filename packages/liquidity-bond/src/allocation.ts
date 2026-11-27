import type {
  LiquidityAllocation,
  LiquidityBondVerifyResult,
  CreateLiquidityAllocationParams,
  VerifyLiquidityAllocationParams,
} from './types.js';

let allocationCounter = 0;

export function createLiquidityAllocation(params: CreateLiquidityAllocationParams): LiquidityAllocation {
  const now = params.createdAt ?? Date.now();
  allocationCounter++;
  return {
    allocationId: `alloc-${now}-${allocationCounter}`,
    positionId: params.positionId,
    poolId: params.poolId,
    amount: params.amount,
    purpose: params.purpose,
    allocationType: params.allocationType,
    status: 'active',
    createdAt: now,
    metadata: params.metadata,
  };
}

export function releaseLiquidityAllocation(allocation: LiquidityAllocation, now?: number): LiquidityAllocation {
  return { ...allocation, status: 'released', releasedAt: now ?? Date.now() };
}

/** OMN-114: an allocation whose capital is being recovered. Not available. */
export function markAllocationSettling(allocation: LiquidityAllocation, now?: number): LiquidityAllocation {
  return { ...allocation, status: 'settling', metadata: { ...allocation.metadata, settlingAt: now ?? Date.now() } };
}

export function markAllocationDepleted(allocation: LiquidityAllocation, now?: number): LiquidityAllocation {
  return { ...allocation, status: 'depleted', releasedAt: now ?? Date.now() };
}

export function verifyLiquidityAllocation(params: VerifyLiquidityAllocationParams): LiquidityBondVerifyResult {
  const { allocation, position } = params;

  if (allocation.amount <= 0n) {
    return { ok: false, reason: 'Allocation amount must be positive', code: 'ALLOCATION_INVALID' };
  }

  // OMN-112: headroom is the risk-adjusted capacity minus BOTH allocated and
  // reserved capital. Verifying against the gross amount would let a position
  // overcommit what it can actually support.
  const capacity = position.effectiveAmount ?? position.amount;
  const committed = (position.allocatedAmount ?? 0n) + (position.reservedAmount ?? 0n);
  const available = capacity > committed ? capacity - committed : 0n;
  if (allocation.amount > available) {
    return { ok: false, reason: 'Allocation exceeds position headroom', code: 'ALLOCATION_EXCEEDS_POSITION' };
  }

  return { ok: true, code: 'OK' };
}

export function sumActiveAllocations(allocations: LiquidityAllocation[]): bigint {
  return allocations
    .filter((a) => a.status === 'active')
    .reduce((sum, a) => sum + a.amount, 0n);
}
