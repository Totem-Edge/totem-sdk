import { OmniaVtxoPool, CreatePoolParams, VtxoPoolPolicy } from './types.js';
import { VtxoPoolCapacityError, VtxoPolicyError } from './errors.js';
import { DEFAULT_POLICY, EMPTY_TREE_ROOT, EPOCH_ZERO } from './constants.js';
import { computePoolId } from './commitment.js';

export function createPool(params: CreatePoolParams, now: number): OmniaVtxoPool {
  const policy: VtxoPoolPolicy = {
    minAmount: params.policy?.minAmount ?? DEFAULT_POLICY.minAmount,
    maxAmount: params.policy?.maxAmount ?? DEFAULT_POLICY.maxAmount,
    maxMergeInputs: params.policy?.maxMergeInputs ?? DEFAULT_POLICY.maxMergeInputs,
    maxSplitOutputs: params.policy?.maxSplitOutputs ?? DEFAULT_POLICY.maxSplitOutputs,
    exitTimelockSeconds: params.policy?.exitTimelockSeconds ?? DEFAULT_POLICY.exitTimelockSeconds,
  };

  if (params.totalCapacity <= BigInt(0)) {
    throw new VtxoPolicyError('Pool totalCapacity must be > 0');
  }

  const poolId = computePoolId({
    operator: params.operator,
    tokenId: params.tokenId,
    nonce: params.nonce,
  });

  return {
    poolId,
    operator: params.operator,
    tokenId: params.tokenId,
    totalCapacity: params.totalCapacity,
    availableCapacity: params.totalCapacity,
    epoch: EPOCH_ZERO,
    commitmentRoot: EMPTY_TREE_ROOT,
    createdAt: now,
    policy,
  };
}

export function assertPoolCanMint(pool: OmniaVtxoPool, amount: bigint): void {
  if (amount <= BigInt(0)) {
    throw new VtxoPolicyError(`Mint amount must be > 0, got ${amount}`);
  }
  if (amount < pool.policy.minAmount) {
    throw new VtxoPolicyError(
      `Mint amount ${amount} is below pool minimum ${pool.policy.minAmount}`
    );
  }
  if (amount > pool.policy.maxAmount) {
    throw new VtxoPolicyError(
      `Mint amount ${amount} exceeds pool maximum ${pool.policy.maxAmount}`
    );
  }
  if (amount > pool.availableCapacity) {
    throw new VtxoPoolCapacityError(
      `Insufficient pool capacity: requested ${amount}, available ${pool.availableCapacity}`,
      amount,
      pool.availableCapacity,
    );
  }
}

export function updatePoolRoot(pool: OmniaVtxoPool, root: string): OmniaVtxoPool {
  return { ...pool, commitmentRoot: root };
}

export function advancePoolEpoch(pool: OmniaVtxoPool, newEpoch: number): OmniaVtxoPool {
  if (newEpoch <= pool.epoch) {
    throw new VtxoPolicyError(
      `New epoch ${newEpoch} must be greater than current epoch ${pool.epoch}`
    );
  }
  return { ...pool, epoch: newEpoch };
}
