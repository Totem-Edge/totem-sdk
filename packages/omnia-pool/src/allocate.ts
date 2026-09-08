/**
 * omnia-pool/allocate.ts — Capital allocation primitives.
 *
 * Maps liquidity-bond allocations to live Omnia execution backends.
 */

import {
  attachLiquidityAllocation,
  createLiquidityAllocation,
  markAllocationDepleted,
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

function allocateTypeMatchesPurpose(type: AllocationType, purpose: LiquidityPurpose): boolean {
  // Purpose/type alignment table (permissive — backends may be more specific).
  const map: Record<AllocationType, LiquidityPurpose[]> = {
    'route-reserve': ['omnia-router-liquidity'],
    'channel-capital': ['omnia-channel-capital'],
    'factory-capital': ['omnia-factory-capital'],
    'rfq-inventory': ['rfq-inventory'],
    'settlement-reserve': ['merchant-settlement-reserve', 'statechain-exit-reserve'],
    'manual-reserve': ['community-liquidity', 'sandbox-liquidity'],
  };
  return map[type]?.includes(purpose) ?? true;
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

  const allocation = createLiquidityAllocation({
    positionId: position.positionId,
    poolId: position.poolId,
    amount,
    purpose: params.purpose,
    allocationType: params.allocationType,
    metadata: params.metadata,
  });

  const verify = verifyLiquidityAllocation({ allocation, position });
  if (!verify.ok) {
    throw new Error(verify.reason ?? 'allocation verification failed');
  }

  // Execute against the appropriate backend if a port is supplied.
  let execution: unknown;
  switch (params.target.type) {
    case 'channel': {
      if (!params.ctx?.omnia) {
        throw new Error('omnia execution port required for channel allocation');
      }
      const channel = await params.ctx.omnia.createChannel(params.target.params);
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

  return { allocation, position: updatedPosition, registry: nextRegistry, execution };
}

/**
 * Release an allocation and restore its position's available liquidity.
 */
export function releaseAllocation(
  params: ReleaseAllocationParams,
  registry: LiquidityBondRegistryState,
): { allocation: LiquidityAllocation; position: LiquidityPosition; registry: LiquidityBondRegistryState } {
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

  return { allocation: released, position: updatedPosition, registry: nextRegistry };
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
  const { allocation: released, position: releasedPosition, registry: releasedRegistry } = releaseAllocation(
    { allocation: params.from, position },
    registry,
  );

  const newAllocation = await allocatePositionCapital(
    {
      position: releasedPosition,
      amount: params.amount,
      allocationType: params.toTarget.type === 'vtxo'
        ? 'manual-reserve'
        : (params.from.allocationType),
      purpose: params.from.purpose,
      target: params.toTarget,
      ctx: params.ctx,
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
