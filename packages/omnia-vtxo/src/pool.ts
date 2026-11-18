import {
  OmniaVtxo,
  OmniaVtxoPool,
  CreatePoolParams,
  VtxoPoolPolicy,
  VtxoPoolMember,
  VtxoEpochRoot,
  VtxoProof,
  VtxoId,
} from './types.js';
import { VtxoPoolCapacityError, VtxoPolicyError } from './errors.js';
import { DEFAULT_POLICY, EMPTY_TREE_ROOT, EPOCH_ZERO } from './constants.js';
import {
  computePoolId,
  buildVtxoProofSetFromMembers,
  vtxoCommitmentMember,
} from './commitment.js';

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
    members: [],
    epochRoots: [],
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

export interface CommitPoolMembersOptions {
  /** Epoch for the new batch. Must be strictly greater than `pool.epoch`. Defaults to `pool.epoch + 1`. */
  epoch?: number;
}

export interface CommitPoolMembersResult {
  pool: OmniaVtxoPool;
  /** Proofs for every member of the pool set, rebuilt against the new root. */
  proofs: Record<VtxoId, VtxoProof>;
}

/**
 * Append VTXOs to the pool's membership set and rebuild the commitment tree
 * (OMN-002).
 *
 * The pool's `commitmentRoot` commits to the whole set (`members`), not to a
 * single leaf: appending a member never removes an earlier member, and the
 * previous root is retained in `epochRoots` so proofs issued in earlier epochs
 * stay verifiable. Every batch advances `epoch`; `batchId` tracks the root.
 *
 * Idempotent for a member already present with the same leaf; a conflicting
 * leaf for an existing `vtxoId` is rejected.
 */
export function commitPoolMembers(
  pool: OmniaVtxoPool,
  vtxos: readonly OmniaVtxo[],
  options: CommitPoolMembersOptions = {},
): CommitPoolMembersResult {
  if (vtxos.length === 0) {
    throw new VtxoPolicyError('commitPoolMembers requires at least one VTXO');
  }
  const epoch = options.epoch ?? pool.epoch + 1;
  if (!Number.isInteger(epoch) || epoch <= pool.epoch) {
    throw new VtxoPolicyError(
      `Batch epoch ${epoch} must be an integer greater than the pool epoch ${pool.epoch}`
    );
  }

  const members: VtxoPoolMember[] = [...(pool.members ?? [])];
  const byId = new Map(members.map((member) => [member.vtxoId, member]));
  const incoming: VtxoPoolMember[] = [];

  for (const vtxo of vtxos) {
    if (vtxo.poolId !== pool.poolId) {
      throw new VtxoPolicyError(
        `VTXO ${vtxo.vtxoId} belongs to pool ${vtxo.poolId}, not ${pool.poolId}`
      );
    }
    if (vtxo.tokenId !== pool.tokenId) {
      throw new VtxoPolicyError(
        `VTXO ${vtxo.vtxoId} token ${vtxo.tokenId} does not match pool token ${pool.tokenId}`
      );
    }
    const member = vtxoCommitmentMember(vtxo);
    if (member.epoch !== epoch) {
      throw new VtxoPolicyError(
        `VTXO ${vtxo.vtxoId} epoch ${member.epoch} does not match batch epoch ${epoch}`
      );
    }
    const existing = byId.get(member.vtxoId);
    if (existing) {
      if (existing.leaf !== member.leaf) {
        throw new VtxoPolicyError(
          `VTXO ${member.vtxoId} already committed with a different leaf`
        );
      }
      continue;
    }
    byId.set(member.vtxoId, member);
    members.push(member);
    incoming.push(member);
  }

  const { root, proofs } = buildVtxoProofSetFromMembers(members);
  const epochRoots: VtxoEpochRoot[] = [...(pool.epochRoots ?? [])];
  const previous = epochRoots.find((entry) => entry.epoch === epoch);
  if (previous && previous.root !== root) {
    throw new VtxoPolicyError(`Conflicting root for epoch ${epoch}`);
  }
  if (!previous) {
    epochRoots.push({
      epoch,
      root,
      batchId: root,
      vtxoIds: incoming.map((member) => member.vtxoId),
    });
  }

  return {
    pool: {
      ...pool,
      epoch,
      commitmentRoot: root,
      members,
      epochRoots,
    },
    proofs,
  };
}

/** Every root the pool has published (current + historical epochs). */
export function poolPublishedRoots(pool: OmniaVtxoPool): string[] {
  const roots = new Set<string>();
  if (pool.commitmentRoot) roots.add(pool.commitmentRoot);
  for (const entry of pool.epochRoots ?? []) roots.add(entry.root);
  return [...roots];
}

/** The published epoch record for `epoch`, if the pool has one. */
export function poolEpochRoot(pool: OmniaVtxoPool, epoch: number): VtxoEpochRoot | undefined {
  return (pool.epochRoots ?? []).find((entry) => entry.epoch === epoch);
}

/**
 * OMN-055: atomically consume members and add replacement members, publishing a
 * new root at the target epoch. Transfer and refresh outputs become real pool
 * members only through this transition.
 */
export function transitionPoolMembers(
  pool: OmniaVtxoPool,
  params: {
    consume: readonly string[];
    add: readonly OmniaVtxo[];
    epoch?: number;
  },
): { pool: OmniaVtxoPool; proofs: Record<string, VtxoProof> } {
  const epoch = params.epoch ?? pool.epoch + 1;
  if (!Number.isInteger(epoch) || epoch <= pool.epoch) {
    throw new VtxoPolicyError(
      `Transition epoch ${epoch} must be an integer greater than the pool epoch ${pool.epoch}`,
    );
  }
  const consumed = new Set(pool.consumedVtxoIds ?? []);
  const existingIds = new Set((pool.members ?? []).map((member) => member.vtxoId));
  for (const id of params.consume) {
    if (!existingIds.has(id)) {
      throw new VtxoPolicyError(`Cannot consume ${id}: it is not a current pool member`);
    }
    if (consumed.has(id)) {
      throw new VtxoPolicyError(`VTXO ${id} was already consumed`);
    }
  }
  const consumedSet = new Set(params.consume);
  const members: VtxoPoolMember[] = (pool.members ?? []).filter(
    (member) => !consumedSet.has(member.vtxoId),
  );
  const byId = new Map(members.map((member) => [member.vtxoId, member]));
  for (const vtxo of params.add) {
    if (vtxo.poolId !== pool.poolId) {
      throw new VtxoPolicyError(`VTXO ${vtxo.vtxoId} belongs to pool ${vtxo.poolId}`);
    }
    if (vtxo.tokenId !== pool.tokenId) {
      throw new VtxoPolicyError(`VTXO ${vtxo.vtxoId} token does not match the pool`);
    }
    if (consumed.has(vtxo.vtxoId) || consumedSet.has(vtxo.vtxoId)) {
      throw new VtxoPolicyError(`VTXO ${vtxo.vtxoId} was already consumed`);
    }
    const member = vtxoCommitmentMember({ ...vtxo, epoch });
    byId.set(member.vtxoId, member);
  }
  const nextMembers = [...byId.values()];
  const { root, proofs } = buildVtxoProofSetFromMembers(nextMembers);
  const epochRoots: VtxoEpochRoot[] = [
    ...(pool.epochRoots ?? []).filter((entry) => entry.epoch !== epoch),
    {
      epoch,
      root,
      batchId: root,
      vtxoIds: params.add.map((vtxo) => vtxo.vtxoId),
    },
  ];
  return {
    pool: {
      ...pool,
      epoch,
      commitmentRoot: root,
      members: nextMembers,
      epochRoots,
      consumedVtxoIds: [...consumed, ...params.consume],
    },
    proofs,
  };
}
