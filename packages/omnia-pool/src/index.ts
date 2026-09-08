/**
 * @module @totemsdk/omnia-pool
 *
 * Generic Omnia liquidity pool orchestration primitive.
 *
 * Sits between `liquidity-bond` (deterministic LP accounting) and the live
 * Omnia execution family (`omnia`, `omnia-factory`, `omnia-router`,
 * `omnia-splice`, `omnia-vtxo`) to deploy, allocate, and withdraw pooled
 * capital.
 */

export {
  createOmniaPool,
  loadOmniaPool,
  makeOmniaLockTerms,
  makeOmniaFeePolicy,
} from './pool.js';

export {
  commitToPool,
  acceptCommitment,
  createPositionFromCommitment,
  issueLpReceipt,
  depositToPool,
} from './deposit.js';

export {
  allocatePositionCapital,
  releaseAllocation,
  rebalancePoolCapital,
  quiescePosition,
} from './allocate.js';

export {
  recordPoolFee,
  computeUnclaimedFees,
  claimFees,
  compoundFees,
  getUtilisation,
  toOmniaPoolFeeRecord,
} from './fees.js';

export { computePoolNAV, computePoolRiskScore } from './nav.js';

export { createChannelLoader, loadChannelFromSnapshotStore, saveChannelSnapshot } from './load-channel.js';
export type { ChannelSnapshotStore } from './load-channel.js';

export { maybeSignTransition, commitRegistryTransition } from './rooting.js';

export {
  withdrawLiquidity,
  approveWithdrawal,
  executePoolPayout,
} from './withdraw.js';

export type {
  DepositToPoolResult,
  CreateOmniaPoolParams,
  OmniaPoolDeploymentContext,
  OmniaPoolAllocationContext,
  PoolSigner,
  OmniaExecutionPort,
  ChannelCloseResult,
  FactoryExecutionPort,
  RouterExecutionPort,
  SpliceExecutionPort,
  VtxoExecutionPort,
  RegistryRootingContext,
  OmniaPoolFeeRecord,
  PoolNAV,
  OmniaPool,
  AllocationTarget,
  WithdrawLiquidityOptions,
  OmniaPoolWithdrawalResult,
  ClaimFeesOptions,
  CompoundFeesOptions,
  AllocatePositionCapitalParams,
  AllocationResult,
  ReleaseAllocationParams,
  RebalanceAllocationParams,
  ExecutePoolPayoutParams,
  RecordPoolFeeParams,
} from './types.js';
