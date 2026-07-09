**@totemsdk/omnia**

***

# @totemsdk/omnia

## Classes

- [BalanceConservationError](classes/BalanceConservationError.md)
- [ChannelCapacityError](classes/ChannelCapacityError.md)
- [ChannelStatusError](classes/ChannelStatusError.md)
- [DoubleSignError](classes/DoubleSignError.md)
- [SequenceError](classes/SequenceError.md)
- [SigningIndexMonotonicityError](classes/SigningIndexMonotonicityError.md)

## Interfaces

- [AddHTLCParams](interfaces/AddHTLCParams.md)
- [AgentPolicy](interfaces/AgentPolicy.md)
- [AgentReceipt](interfaces/AgentReceipt.md)
- [ChannelLogEntry](interfaces/ChannelLogEntry.md)
- [ChannelParticipant](interfaces/ChannelParticipant.md)
- [ChannelProposal](interfaces/ChannelProposal.md)
- [ChannelReceipt](interfaces/ChannelReceipt.md)
- [ChannelSigner](interfaces/ChannelSigner.md)
- [ChannelWatermark](interfaces/ChannelWatermark.md)
- [CreateChannelParams](interfaces/CreateChannelParams.md)
- [DisputePayload](interfaces/DisputePayload.md)
- [HTLCRecord](interfaces/HTLCRecord.md)
- [IntentResult](interfaces/IntentResult.md)
- [KissvmEvaluator](interfaces/KissvmEvaluator.md)
- [OmniaChannel](interfaces/OmniaChannel.md)
- [OmniaTxDraft](interfaces/OmniaTxDraft.md)
- [PaymentIntent](interfaces/PaymentIntent.md)
- [SettlementPayload](interfaces/SettlementPayload.md)
- [SignedChannelState](interfaces/SignedChannelState.md)
- [StateValue](interfaces/StateValue.md)
- [TxInputDraft](interfaces/TxInputDraft.md)
- [TxOutputDraft](interfaces/TxOutputDraft.md)
- [UpdateDelta](interfaces/UpdateDelta.md)
- [UpdateStateResult](interfaces/UpdateStateResult.md)
- [VerifyStateOptions](interfaces/VerifyStateOptions.md)

## Type Aliases

- [CapacityWarning](type-aliases/CapacityWarning.md)
- [ChannelStatus](type-aliases/ChannelStatus.md)
- [partyId](type-aliases/partyId.md)

## Variables

- [CAPACITY\_NEAR\_EXHAUSTION](variables/CAPACITY_NEAR_EXHAUSTION.md)
- [CAPACITY\_WARNING\_APPROACHING](variables/CAPACITY_WARNING_APPROACHING.md)
- [CAPACITY\_WARNING\_CRITICAL](variables/CAPACITY_WARNING_CRITICAL.md)
- [COINID\_ELTOO](variables/COINID_ELTOO.md)
- [WOTS\_CAPACITY\_TOTAL](variables/WOTS_CAPACITY_TOTAL.md)

## Functions

- [\_resetChannelWatermarks](functions/resetChannelWatermarks.md)
- [acceptChannel](functions/acceptChannel.md)
- [activateChannel](functions/activateChannel.md)
- [addHTLC](functions/addHTLC.md)
- [assessCapacity](functions/assessCapacity.md)
- [attachCounterpartySignature](functions/attachCounterpartySignature.md)
- [buildAndHashEltooScript](functions/buildAndHashEltooScript.md)
- [buildDisputePayload](functions/buildDisputePayload.md)
- [buildEltooScript](functions/buildEltooScript.md)
- [buildFundingTx](functions/buildFundingTx.md)
- [buildSettlementTx](functions/buildSettlementTx.md)
- [buildTxPoWPayload](functions/buildTxPoWPayload.md)
- [buildUpdateTx](functions/buildUpdateTx.md)
- [computeStateCommitment](functions/computeStateCommitment.md)
- [computeTxDraftDigest](functions/computeTxDraftDigest.md)
- [createChannel](functions/createChannel.md)
- [deserializeTxDraft](functions/deserializeTxDraft.md)
- [enforceUpdateGuards](functions/enforceUpdateGuards.md)
- [executeIntent](functions/executeIntent.md)
- [flatSigningIndex](functions/flatSigningIndex.md)
- [fulfillHTLC](functions/fulfillHTLC.md)
- [getChannelReceipt](functions/getChannelReceipt.md)
- [markChannelClosed](functions/markChannelClosed.md)
- [markChannelClosing](functions/markChannelClosing.md)
- [normalizeScript](functions/normalizeScript.md)
- [omniaDraftToMinimaBytes](functions/omniaDraftToMinimaBytes.md)
- [proposeSettlement](functions/proposeSettlement.md)
- [scriptAddress](functions/scriptAddress.md)
- [serializeTxDraft](functions/serializeTxDraft.md)
- [signState](functions/signState.md)
- [signTxDraft](functions/signTxDraft.md)
- [timeoutHTLC](functions/timeoutHTLC.md)
- [toEnhancedBuildParams](functions/toEnhancedBuildParams.md)
- [updateState](functions/updateState.md)
- [validateStateTransition](functions/validateStateTransition.md)
- [verifyState](functions/verifyState.md)
- [verifyStateSignature](functions/verifyStateSignature.md)
