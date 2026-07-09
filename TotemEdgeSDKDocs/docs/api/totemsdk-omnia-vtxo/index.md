**@totemsdk/omnia-vtxo**

***

# @totemsdk/omnia-vtxo

## Classes

- [MemoryOmniaVtxoStore](classes/MemoryOmniaVtxoStore.md)
- [OmniaVtxoError](classes/OmniaVtxoError.md)
- [VtxoAmountError](classes/VtxoAmountError.md)
- [VtxoExitError](classes/VtxoExitError.md)
- [VtxoMergeError](classes/VtxoMergeError.md)
- [VtxoOwnershipError](classes/VtxoOwnershipError.md)
- [VtxoPolicyError](classes/VtxoPolicyError.md)
- [VtxoPoolCapacityError](classes/VtxoPoolCapacityError.md)
- [VtxoProofError](classes/VtxoProofError.md)
- [VtxoSplitError](classes/VtxoSplitError.md)
- [VtxoStatusError](classes/VtxoStatusError.md)

## Interfaces

- [ComputePoolIdParams](interfaces/ComputePoolIdParams.md)
- [ComputeVtxoIdParams](interfaces/ComputeVtxoIdParams.md)
- [ConservationInput](interfaces/ConservationInput.md)
- [CreatePoolParams](interfaces/CreatePoolParams.md)
- [ExitDraft](interfaces/ExitDraft.md)
- [MergeResult](interfaces/MergeResult.md)
- [MergeVtxosParams](interfaces/MergeVtxosParams.md)
- [MerkleProofNode](interfaces/MerkleProofNode.md)
- [MintResult](interfaces/MintResult.md)
- [MintVtxoParams](interfaces/MintVtxoParams.md)
- [OmniaVtxo](interfaces/OmniaVtxo.md)
- [OmniaVtxoOperator](interfaces/OmniaVtxoOperator.md)
- [OmniaVtxoPool](interfaces/OmniaVtxoPool.md)
- [OmniaVtxoStore](interfaces/OmniaVtxoStore.md)
- [RefreshResult](interfaces/RefreshResult.md)
- [RefreshVtxoParams](interfaces/RefreshVtxoParams.md)
- [SplitResult](interfaces/SplitResult.md)
- [SplitVtxoParams](interfaces/SplitVtxoParams.md)
- [TransferResult](interfaces/TransferResult.md)
- [TransferVtxoParams](interfaces/TransferVtxoParams.md)
- [VerifyVtxoResult](interfaces/VerifyVtxoResult.md)
- [VtxoExitIntent](interfaces/VtxoExitIntent.md)
- [VtxoHistoryEntry](interfaces/VtxoHistoryEntry.md)
- [VtxoOperatorReceipt](interfaces/VtxoOperatorReceipt.md)
- [VtxoPoolPolicy](interfaces/VtxoPoolPolicy.md)
- [VtxoProof](interfaces/VtxoProof.md)
- [VtxoProofSet](interfaces/VtxoProofSet.md)
- [VtxoTransfer](interfaces/VtxoTransfer.md)
- [VtxoTransferIntent](interfaces/VtxoTransferIntent.md)

## Type Aliases

- [VtxoId](type-aliases/VtxoId.md)
- [VtxoOp](type-aliases/VtxoOp.md)
- [VtxoStatus](type-aliases/VtxoStatus.md)

## Variables

- [DEFAULT\_POLICY](variables/DEFAULT_POLICY.md)
- [EMPTY\_LEAF](variables/EMPTY_LEAF.md)
- [EMPTY\_TREE\_ROOT](variables/EMPTY_TREE_ROOT.md)
- [EPOCH\_ZERO](variables/EPOCH_ZERO.md)
- [MOCK\_BATCH\_ID](variables/MOCK_BATCH_ID.md)
- [MOCK\_OPERATOR\_SIGNATURE](variables/MOCK_OPERATOR_SIGNATURE.md)

## Functions

- [advancePoolEpoch](functions/advancePoolEpoch.md)
- [assertPoolCanMint](functions/assertPoolCanMint.md)
- [buildVtxoExitIntent](functions/buildVtxoExitIntent.md)
- [buildVtxoProofSet](functions/buildVtxoProofSet.md)
- [buildVtxoTransferIntent](functions/buildVtxoTransferIntent.md)
- [computeCommitmentRoot](functions/computeCommitmentRoot.md)
- [computePoolId](functions/computePoolId.md)
- [computeReceiptId](functions/computeReceiptId.md)
- [computeVtxoId](functions/computeVtxoId.md)
- [computeVtxoLeaf](functions/computeVtxoLeaf.md)
- [createExitDraft](functions/createExitDraft.md)
- [createPool](functions/createPool.md)
- [deserializePool](functions/deserializePool.md)
- [deserializeVtxo](functions/deserializeVtxo.md)
- [isVtxoActive](functions/isVtxoActive.md)
- [markExited](functions/markExited.md)
- [markExiting](functions/markExiting.md)
- [markVtxoSpent](functions/markVtxoSpent.md)
- [mergeVtxos](functions/mergeVtxos.md)
- [mintVtxo](functions/mintVtxo.md)
- [refreshVtxo](functions/refreshVtxo.md)
- [serializePool](functions/serializePool.md)
- [serializeVtxo](functions/serializeVtxo.md)
- [splitVtxo](functions/splitVtxo.md)
- [transferVtxo](functions/transferVtxo.md)
- [updatePoolRoot](functions/updatePoolRoot.md)
- [verifyConservation](functions/verifyConservation.md)
- [verifyMerkleProof](functions/verifyMerkleProof.md)
- [verifyVtxo](functions/verifyVtxo.md)
- [verifyVtxoProof](functions/verifyVtxoProof.md)
- [verifyVtxoTransfer](functions/verifyVtxoTransfer.md)
