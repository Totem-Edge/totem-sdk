**@totemsdk/omnia-pool**

***

**Maturity: rc**

# @totemsdk/omnia-pool

## Interfaces

- [AutonomousRebalanceOptions](interfaces/AutonomousRebalanceOptions.md)
- [AutonomousRebalanceResult](interfaces/AutonomousRebalanceResult.md)
- [ChannelCloseResult](interfaces/ChannelCloseResult.md)
- [ChannelSnapshotStore](interfaces/ChannelSnapshotStore.md)
- [ClaimFeesOptions](interfaces/ClaimFeesOptions.md)
- [CompoundFeesOptions](interfaces/CompoundFeesOptions.md)
- [CreateOmniaPoolParams](interfaces/CreateOmniaPoolParams.md)
- [DepositToPoolResult](interfaces/DepositToPoolResult.md)
- [DurableChannelSnapshotStore](interfaces/DurableChannelSnapshotStore.md)
- [DurableChannelSnapshotStoreOptions](interfaces/DurableChannelSnapshotStoreOptions.md)
- [FactoryExecutionPort](interfaces/FactoryExecutionPort.md)
- [OmniaExecutionPort](interfaces/OmniaExecutionPort.md)
- [OmniaPool](interfaces/OmniaPool.md)
- [OmniaPoolAllocationContext](interfaces/OmniaPoolAllocationContext.md)
- [OmniaPoolDeploymentContext](interfaces/OmniaPoolDeploymentContext.md)
- [OmniaPoolFeeRecord](interfaces/OmniaPoolFeeRecord.md)
- [OmniaPoolWithdrawalResult](interfaces/OmniaPoolWithdrawalResult.md)
- [PoolNAV](interfaces/PoolNAV.md)
- [PoolSigner](interfaces/PoolSigner.md)
- [PreparedRebalanceStep](interfaces/PreparedRebalanceStep.md)
- [RebalanceChannelUpdate](interfaces/RebalanceChannelUpdate.md)
- [RegistryRootingContext](interfaces/RegistryRootingContext.md)
- [RouterExecutionPort](interfaces/RouterExecutionPort.md)
- [SpliceExecutionPort](interfaces/SpliceExecutionPort.md)
- [VtxoExecutionPort](interfaces/VtxoExecutionPort.md)
- [WithdrawLiquidityOptions](interfaces/WithdrawLiquidityOptions.md)

## Type Aliases

- [AllocatePositionCapitalParams](type-aliases/AllocatePositionCapitalParams.md)
- [AllocationResult](type-aliases/AllocationResult.md)
- [AllocationTarget](type-aliases/AllocationTarget.md)
- [ExecutePoolPayoutParams](type-aliases/ExecutePoolPayoutParams.md)
- [RebalanceAllocationParams](type-aliases/RebalanceAllocationParams.md)
- [RecordPoolFeeParams](type-aliases/RecordPoolFeeParams.md)
- [ReleaseAllocationParams](type-aliases/ReleaseAllocationParams.md)

## Functions

- [acceptCommitment](functions/acceptCommitment.md)
- [allocatePositionCapital](functions/allocatePositionCapital.md)
- [approveWithdrawal](functions/approveWithdrawal.md)
- [claimFees](functions/claimFees.md)
- [commitRegistryTransition](functions/commitRegistryTransition.md)
- [commitToPool](functions/commitToPool.md)
- [compoundFees](functions/compoundFees.md)
- [computePoolNAV](functions/computePoolNAV.md)
- [computePoolRiskScore](functions/computePoolRiskScore.md)
- [computeUnclaimedFees](functions/computeUnclaimedFees.md)
- [createChannelLoader](functions/createChannelLoader.md)
- [createDurableChannelSnapshotStore](functions/createDurableChannelSnapshotStore.md)
- [createOmniaPool](functions/createOmniaPool.md)
- [createPositionFromCommitment](functions/createPositionFromCommitment.md)
- [depositToPool](functions/depositToPool.md)
- [executeAutonomousRebalanceStep](functions/executeAutonomousRebalanceStep.md)
- [executePoolPayout](functions/executePoolPayout.md)
- [getUtilisation](functions/getUtilisation.md)
- [issueLpReceipt](functions/issueLpReceipt.md)
- [loadChannelFromSnapshotStore](functions/loadChannelFromSnapshotStore.md)
- [loadOmniaPool](functions/loadOmniaPool.md)
- [makeOmniaFeePolicy](functions/makeOmniaFeePolicy.md)
- [makeOmniaLockTerms](functions/makeOmniaLockTerms.md)
- [maybeSignTransition](functions/maybeSignTransition.md)
- [prepareRebalanceStep](functions/prepareRebalanceStep.md)
- [quiescePosition](functions/quiescePosition.md)
- [rebalancePoolCapital](functions/rebalancePoolCapital.md)
- [recordPoolFee](functions/recordPoolFee.md)
- [releaseAllocation](functions/releaseAllocation.md)
- [saveChannelSnapshot](functions/saveChannelSnapshot.md)
- [toOmniaPoolFeeRecord](functions/toOmniaPoolFeeRecord.md)
- [withdrawLiquidity](functions/withdrawLiquidity.md)
