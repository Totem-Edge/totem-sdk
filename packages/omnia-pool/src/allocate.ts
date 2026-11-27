/**
 * omnia-pool/allocate.ts — Capital allocation primitives.
 *
 * Maps liquidity-bond allocations to live Omnia execution backends.
 */

import {
  attachLiquidityAllocation,
  createLiquidityAllocation,
  markAllocationDepleted,
  markAllocationSettling,
  registerLiquidityPosition,
  releaseLiquidityAllocation,
  sumActiveAllocations,
  verifyLiquidityAllocation,
  type AllocationType,
  type LiquidityAllocation,
  type LiquidityBondRegistryState,
  type LiquidityPosition,
  type LiquidityPurpose,
} from '@totemsdk/liquidity-bond';
import type {
  AllocationTarget,
  AllocatePositionCapitalParams,
  AllocationResult,
  OmniaPoolAllocationContext,
  ReleaseAllocationParams,
  RebalanceAllocationParams,
} from './types.js';
import { maybeSignTransition } from './rooting.js';

function allocateTypeMatchesPurpose(type: AllocationType, purpose: LiquidityPurpose): boolean {
  // Purpose/type alignment table (permissive — backends may be more specific).
  const map: Record<AllocationType, LiquidityPurpose[]> = {
    'route-reserve': ['omnia-router-liquidity'],
    'channel-capital': ['omnia-channel-capital'],
    'factory-capital': ['omnia-factory-capital'],
    'rfq-inventory': ['rfq-inventory'],
    'settlement-reserve': ['merchant-settlement-reserve', 'statechain-exit-reserve'],
    'vtxo-backing': ['vtxo-pool-backing'],
    'manual-reserve': ['community-liquidity', 'sandbox-liquidity'],
  };
  return map[type]?.includes(purpose) ?? true;
}

async function persistChannelSnapshot(ctx: OmniaPoolAllocationContext | undefined, channel: unknown): Promise<void> {
  if (ctx?.saveChannelSnapshot && channel && typeof channel === 'object') {
    await ctx.saveChannelSnapshot(channel as never);
  }
}

/**
 * Co-sign gate (#21/#26): before a channel-backed allocation is committed, the
 * live execution port must verify the channel's latest state (sequence,
 * conservation, commitment, program hook, signatures). When the channel carries
 * a registry-root program transition, the announced root must match the pool's
 * anchor root — on-chain settlement cannot override an off-chain position.
 */
async function verifyChannelForCoSign(
  ctx: OmniaPoolAllocationContext | undefined,
  channel: unknown,
  poolId: string,
  anchorRoot?: string,
): Promise<void> {
  if (!ctx?.omnia || !channel || typeof channel !== 'object') return;
  const ch = channel as { latestState?: unknown; status?: string };
  if (!ch.latestState) return;
  const result = await ctx.omnia.verifyStateForCoSign(ch as never, ch.latestState as never);
  if (!result.valid) {
    throw new Error(`channel co-sign verification failed: ${result.errors.join('; ')}`);
  }
  if (anchorRoot) {
    const { verifyRegistryRootInState } = await import('@totemsdk/omnia');
    const rootCheck = verifyRegistryRootInState(ch.latestState as never, anchorRoot);
    if (!rootCheck.valid) {
      throw new Error(`channel registry-root mismatch: ${rootCheck.error}`);
    }
  }
}

function asBigInt(value: unknown): bigint | undefined {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return undefined;
}

/** OMN-113: the execution target must deploy the authorised amount. */
function assertTargetAmount(target: AllocationTarget, amount: bigint): void {
  switch (target.type) {
    case 'channel': {
      const local = asBigInt(target.params.localAmount);
      const remote = asBigInt(target.params.remoteAmount);
      if (local === undefined || remote === undefined) {
        throw new Error('channel target must declare localAmount and remoteAmount');
      }
      if (local + remote !== amount) {
        throw new Error(
          `channel target deploys ${local + remote} but the allocation is ${amount}`,
        );
      }
      return;
    }
    case 'vtxo': {
      const minted = asBigInt(target.params.amount);
      if (minted === undefined || minted !== amount) {
        throw new Error(`vtxo target mints ${String(target.params.amount)} but the allocation is ${amount}`);
      }
      return;
    }
    case 'factory': {
      const declared = asBigInt((target.params as { totalAmount?: unknown }).totalAmount)
        ?? asBigInt((target.params as { amount?: unknown }).amount);
      if (declared === undefined) {
        throw new Error('factory target must declare totalAmount or amount');
      }
      if (declared !== amount) {
        throw new Error(`factory target deploys ${declared} but the allocation is ${amount}`);
      }
      return;
    }
    case 'router': {
      const capacity = asBigInt(target.channel.htlcCapacity);
      if (capacity !== undefined && capacity < amount) {
        throw new Error(`router edge capacity ${capacity} is below the allocation ${amount}`);
      }
      return;
    }
    case 'reserve':
      return;
  }
}

/** OMN-113: the created channel must hold exactly the authorised amount. */
function assertDeployedChannelAmount(channel: unknown, amount: bigint): void {
  const total = asBigInt((channel as { totalValue?: unknown } | null | undefined)?.totalValue);
  if (total !== undefined && total !== amount) {
    throw new Error(`created channel totalValue ${total} does not match the allocation ${amount}`);
  }
}

/**
 * Allocate capital from a position to a specific Omnia execution backend.
 */
export async function allocatePositionCapital(
  params: AllocatePositionCapitalParams,
  registry: LiquidityBondRegistryState,
): Promise<AllocationResult> {
  const amount = BigInt(params.amount);
  const position = params.position;

  if (!allocateTypeMatchesPurpose(params.allocationType, params.purpose)) {
    throw new Error(
      `allocation type ${params.allocationType} does not match purpose ${params.purpose}`,
    );
  }

  if (amount <= 0n) throw new Error('allocation amount must be positive');

  const allocation = createLiquidityAllocation({
    positionId: position.positionId,
    poolId: position.poolId,
    amount,
    purpose: params.purpose,
    allocationType: params.allocationType,
    metadata: params.metadata,
  });

  // OMN-112: headroom is checked BEFORE any backend is executed, using the
  // risk-adjusted capacity and both allocated and reserved capital. The registry
  // is the authority for what is already committed, so a stale position object
  // cannot understate it.
  const capacity = position.effectiveAmount ?? position.amount;
  const registryCommitted = sumActiveAllocations(registry.allocations[position.positionId] ?? []);
  const recordedCommitted = (position.allocatedAmount ?? 0n) + (position.reservedAmount ?? 0n);
  const committed = registryCommitted > recordedCommitted ? registryCommitted : recordedCommitted;
  const headroom = capacity > committed ? capacity - committed : 0n;
  if (amount > headroom) {
    throw new Error(
      `allocation ${amount} exceeds risk-adjusted headroom ${headroom} (capacity ${capacity}, committed ${committed})`,
    );
  }

  const verify = verifyLiquidityAllocation({ allocation, position });
  if (!verify.ok) {
    throw new Error(verify.reason ?? 'allocation verification failed');
  }

  // OMN-113: the executed operation must deploy exactly the authorised amount.
  // The caller cannot pass a target that moves a different sum.
  assertTargetAmount(params.target, amount);

  // Execute against the appropriate backend if a port is supplied.
  let execution: unknown;
  switch (params.target.type) {
    case 'channel': {
      if (!params.ctx?.omnia) {
        throw new Error('omnia execution port required for channel allocation');
      }
      const channel = await params.ctx.omnia.createChannel(params.target.params);
      assertDeployedChannelAmount(channel, amount);
      await verifyChannelForCoSign(params.ctx, channel, position.poolId, params.anchorRoot);
      await persistChannelSnapshot(params.ctx, channel);
      execution = channel;
      break;
    }
    case 'factory': {
      if (!params.ctx?.factory) {
        throw new Error('factory execution port required for factory allocation');
      }
      const factory = await params.ctx.factory.createFactory(params.target.params);
      execution = factory;
      break;
    }
    case 'router': {
      if (!params.ctx?.router) {
        throw new Error('router execution port required for router allocation');
      }
      const graph = params.ctx.router.createChannelGraph();
      params.ctx.router.addChannel(graph, params.target.channel);
      execution = graph;
      break;
    }
    case 'vtxo': {
      if (!params.ctx?.vtxo) {
        throw new Error('vtxo execution port required for vtxo allocation');
      }
      const result = await params.ctx.vtxo.mintVtxo(
        params.target.pool,
        params.target.params,
      );
      const minted = result as { vtxo?: { amount?: bigint } } | undefined;
      if (minted?.vtxo?.amount !== undefined && minted.vtxo.amount !== amount) {
        throw new Error(`deployed VTXO amount ${minted.vtxo.amount} does not match the allocation ${amount}`);
      }
      execution = result;
      break;
    }
    case 'reserve': {
      // Pure reservation; no live execution.
      execution = { purpose: params.target.purpose };
      break;
    }
  }

  // Update position accounting.
  const activeAllocations = (registry.allocations[position.positionId] ?? []).filter(
    (a) => a.status === 'active',
  );
  const newAllocated = sumActiveAllocations(activeAllocations) + amount;
  const available = position.effectiveAmount ?? position.amount;
  const reservedAmount = newAllocated > available ? newAllocated - available : 0n;
  const allocatedAmount = reservedAmount > 0n ? available : newAllocated;

  const updatedPosition: LiquidityPosition = {
    ...position,
    allocatedAmount,
    reservedAmount,
    availableAmount: available - allocatedAmount,
    status:
      reservedAmount > 0n
        ? 'fully-reserved'
        : allocatedAmount > 0n
          ? 'allocated'
          : position.status,
    updatedAt: Date.now(),
  };

  let nextRegistry = attachLiquidityAllocation(registry, allocation);
  nextRegistry = registerLiquidityPosition(nextRegistry, updatedPosition);

  const signedTransition = await maybeSignTransition(params.rooting, nextRegistry, {
    type: 'allocate',
    poolId: position.poolId,
    positionId: position.positionId,
    allocationId: allocation.allocationId,
    amount,
  });

  return { allocation, position: updatedPosition, registry: nextRegistry, execution, signedTransition };
}

/**
 * Release an allocation and restore its position's available liquidity.
 *
 * OMN-114: releasing is an accounting claim that the capital came back. Without
 * verified recovery evidence the allocation is parked as `settling` and the
 * position keeps its committed capital — availability only increases after
 * `confirmAllocationRecovery` verifies the recovery.
 */
export function releaseAllocation(
  params: ReleaseAllocationParams,
  registry: LiquidityBondRegistryState,
): { allocation: LiquidityAllocation; position: LiquidityPosition; registry: LiquidityBondRegistryState; recovered: boolean } {
  const recovery = params.recovery;
  const recovered = recovery?.verified === true && recovery.recoveredAmount >= params.allocation.amount;
  if (!recovered) {
    const settling = markAllocationSettling(params.allocation);
    const allocations = { ...registry.allocations };
    const list = allocations[params.position.positionId] ?? [];
    allocations[params.position.positionId] = list.map((a) =>
      a.allocationId === settling.allocationId ? settling : a,
    );
    return {
      allocation: settling,
      position: params.position,
      registry: { ...registry, allocations },
      recovered: false,
    };
  }

  const released = releaseLiquidityAllocation(params.allocation);
  const active = (registry.allocations[params.position.positionId] ?? []).filter(
    (a) => a.allocationId !== released.allocationId && a.status === 'active',
  );
  const newAllocated = sumActiveAllocations(active);
  const total = params.position.effectiveAmount ?? params.position.amount;
  const allocatedAmount = newAllocated > total ? total : newAllocated;
  const availableAmount = total - allocatedAmount;

  const updatedPosition: LiquidityPosition = {
    ...params.position,
    allocatedAmount,
    reservedAmount: 0n,
    availableAmount,
    status: allocatedAmount > 0n ? 'allocated' : 'active',
    updatedAt: Date.now(),
  };

  const allocations = { ...registry.allocations };
  const list = allocations[params.position.positionId] ?? [];
  allocations[params.position.positionId] = list.map((a) =>
    a.allocationId === released.allocationId ? released : a,
  );

  let nextRegistry: LiquidityBondRegistryState = { ...registry, allocations };
  nextRegistry = registerLiquidityPosition(nextRegistry, updatedPosition);

  return { allocation: released, position: updatedPosition, registry: nextRegistry, recovered: true };
}

/**
 * OMN-114: confirm a parked release once recovery is verified. The allocation
 * must be `settling`; the evidence must cover the full amount.
 */
export function confirmAllocationRecovery(
  params: ReleaseAllocationParams,
  registry: LiquidityBondRegistryState,
): { allocation: LiquidityAllocation; position: LiquidityPosition; registry: LiquidityBondRegistryState } {
  const recovery = params.recovery;
  if (recovery?.verified !== true) {
    throw new Error('allocation recovery requires verified settlement evidence');
  }
  if (recovery.recoveredAmount < params.allocation.amount) {
    throw new Error(
      `recovered ${recovery.recoveredAmount} is less than the allocation ${params.allocation.amount}`,
    );
  }
  if (params.allocation.status !== 'settling') {
    throw new Error(`allocation ${params.allocation.allocationId} is not pending settlement`);
  }
  return releaseAllocation({ ...params, allocation: { ...params.allocation, status: 'active' } }, registry);
}

/**
 * Rebalance capital from one allocation to another target/backend.
 */
export async function rebalancePoolCapital(
  params: RebalanceAllocationParams,
  position: LiquidityPosition,
  registry: LiquidityBondRegistryState,
): Promise<{
  released: LiquidityAllocation;
  newAllocation: LiquidityAllocation;
  position: LiquidityPosition;
  registry: LiquidityBondRegistryState;
}> {
  const releasedResult = releaseAllocation(
    { allocation: params.from, position, recovery: params.recovery },
    registry,
  );
  if (!releasedResult.recovered) {
    // OMN-114: rebalancing would redeploy capital that has not come back.
    return {
      released: releasedResult.allocation,
      newAllocation: releasedResult.allocation,
      position: releasedResult.position,
      registry: releasedResult.registry,
    };
  }
  const { allocation: released, position: releasedPosition, registry: releasedRegistry } = releasedResult;

  const newAllocation = await allocatePositionCapital(
    {
      position: releasedPosition,
      amount: params.amount,
      allocationType: params.toTarget.type === 'vtxo'
        ? 'vtxo-backing'
        : (params.from.allocationType),
      purpose: params.toTarget.type === 'vtxo'
        ? 'vtxo-pool-backing'
        : (params.from.purpose),
      target: params.toTarget,
      ctx: params.ctx,
      rooting: params.rooting,
      metadata: { rebalanceFrom: params.from.allocationId },
    },
    releasedRegistry,
  );

  return {
    released,
    newAllocation: newAllocation.allocation,
    position: newAllocation.position,
    registry: newAllocation.registry,
  };
}

/**
 * Mark a position and its active allocations as quiescing, preparing for splice-out/close.
 */
export function quiescePosition(
  position: LiquidityPosition,
  registry: LiquidityBondRegistryState,
): { position: LiquidityPosition; registry: LiquidityBondRegistryState } {
  const allocations = { ...registry.allocations };
  const list = (allocations[position.positionId] ?? []).map((a) =>
    a.status === 'active' ? markAllocationDepleted(a) : a,
  );
  allocations[position.positionId] = list;

  const updatedPosition: LiquidityPosition = {
    ...position,
    status: 'quiescing',
    allocatedAmount: 0n,
    reservedAmount: 0n,
    availableAmount: position.effectiveAmount ?? position.amount,
    updatedAt: Date.now(),
  };

  let nextRegistry: LiquidityBondRegistryState = { ...registry, allocations };
  nextRegistry = registerLiquidityPosition(nextRegistry, updatedPosition);

  return { position: updatedPosition, registry: nextRegistry };
}
