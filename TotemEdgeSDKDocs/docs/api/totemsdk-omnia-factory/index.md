**@totemsdk/omnia-factory**

***

**Maturity: rc**

# @totemsdk/omnia-factory

## Interfaces

- [ChannelFactory](interfaces/ChannelFactory.md)
- [DurableFactoryStore](interfaces/DurableFactoryStore.md)
- [DurableFactoryStoreOptions](interfaces/DurableFactoryStoreOptions.md)
- [FactoryApprovalRequest](interfaces/FactoryApprovalRequest.md)
- [FactoryCoordination](interfaces/FactoryCoordination.md)
- [FactoryCoordinationDeps](interfaces/FactoryCoordinationDeps.md)
- [FactoryDisputePayload](interfaces/FactoryDisputePayload.md)
- [FactoryDistributionOutput](interfaces/FactoryDistributionOutput.md)
- [FactoryDistributionScriptConfig](interfaces/FactoryDistributionScriptConfig.md)
- [FactoryFundingMaterial](interfaces/FactoryFundingMaterial.md)
- [FactoryLeaseOps](interfaces/FactoryLeaseOps.md)
- [FactoryLogEntry](interfaces/FactoryLogEntry.md)
- [FactoryOpeningPlan](interfaces/FactoryOpeningPlan.md)
- [FactoryOpeningSignature](interfaces/FactoryOpeningSignature.md)
- [FactoryParticipant](interfaces/FactoryParticipant.md)
- [FactoryRegistryState](interfaces/FactoryRegistryState.md)
- [FactorySettlementDraft](interfaces/FactorySettlementDraft.md)
- [FactorySettlementPayload](interfaces/FactorySettlementPayload.md)
- [FactorySettlementSignature](interfaces/FactorySettlementSignature.md)
- [FinalizeFactoryOpeningOptions](interfaces/FinalizeFactoryOpeningOptions.md)
- [OmniaChannel](interfaces/OmniaChannel.md)
- [VirtualChannelClosePlan](interfaces/VirtualChannelClosePlan.md)
- [VirtualChannelOpenPlan](interfaces/VirtualChannelOpenPlan.md)
- [VirtualChannelOpenSignature](interfaces/VirtualChannelOpenSignature.md)
- [WotsLeaseBundle](interfaces/WotsLeaseBundle.md)

## Type Aliases

- [FactoryApproval](type-aliases/FactoryApproval.md)
- [FactorySignature](type-aliases/FactorySignature.md)
- [FactoryStatus](type-aliases/FactoryStatus.md)

## Variables

- [FACTORY\_BALANCE\_PORT\_BASE](variables/FACTORY_BALANCE_PORT_BASE.md)
- [FACTORY\_BALANCE\_ROOT\_PORT](variables/FACTORY_BALANCE_ROOT_PORT.md)
- [FACTORY\_ESCAPE\_DELAY\_BLOCKS](variables/FACTORY_ESCAPE_DELAY_BLOCKS.md)
- [FACTORY\_ESCAPE\_PORT](variables/FACTORY_ESCAPE_PORT.md)
- [FACTORY\_MAX\_PARTICIPANTS](variables/FACTORY_MAX_PARTICIPANTS.md)
- [FACTORY\_PARTY\_ROOT\_PORT](variables/FACTORY_PARTY_ROOT_PORT.md)
- [MSHS\_PORT\_FLOOR](variables/MSHS_PORT_FLOOR.md)

## Functions

- [acceptFactory](functions/acceptFactory.md)
- [applyFactorySignature](functions/applyFactorySignature.md)
- [assembleFactorySettlement](functions/assembleFactorySettlement.md)
- [assembleVirtualChannelClose](functions/assembleVirtualChannelClose.md)
- [assembleVirtualChannelOpen](functions/assembleVirtualChannelOpen.md)
- [buildAndHashFactoryScript](functions/buildAndHashFactoryScript.md)
- [buildDisputePayload](functions/buildDisputePayload.md)
- [buildFactoryDistributionScript](functions/buildFactoryDistributionScript.md)
- [buildFactoryOpening](functions/buildFactoryOpening.md)
- [buildFactoryScript](functions/buildFactoryScript.md)
- [buildFactorySettlement](functions/buildFactorySettlement.md)
- [buildVirtualChannelClose](functions/buildVirtualChannelClose.md)
- [buildVirtualChannelOpen](functions/buildVirtualChannelOpen.md)
- [closeFactory](functions/closeFactory.md)
- [closeVirtualChannel](functions/closeVirtualChannel.md)
- [computeFactoryStateCommitment](functions/computeFactoryStateCommitment.md)
- [createDurableFactoryStore](functions/createDurableFactoryStore.md)
- [createFactory](functions/createFactory.md)
- [createFactoryCoordination](functions/createFactoryCoordination.md)
- [enforceConservation](functions/enforceConservation.md)
- [factoryBalanceProof](functions/factoryBalanceProof.md)
- [factoryBalanceSetRoot](functions/factoryBalanceSetRoot.md)
- [factoryBalanceStateVariables](functions/factoryBalanceStateVariables.md)
- [factoryDistributionOutputs](functions/factoryDistributionOutputs.md)
- [factoryEscapeStateVariable](functions/factoryEscapeStateVariable.md)
- [factoryPartyProof](functions/factoryPartyProof.md)
- [factoryPartyRootStateVariable](functions/factoryPartyRootStateVariable.md)
- [factoryPartySetRoot](functions/factoryPartySetRoot.md)
- [finalizeFactoryOpening](functions/finalizeFactoryOpening.md)
- [normalizeScript](functions/normalizeScript.md)
- [openVirtualChannel](functions/openVirtualChannel.md)
- [reallocate](functions/reallocate.md)
- [scriptAddress](functions/scriptAddress.md)
- [signFactoryOpening](functions/signFactoryOpening.md)
- [signFactorySettlement](functions/signFactorySettlement.md)
- [signVirtualChannelClose](functions/signVirtualChannelClose.md)
- [signVirtualChannelOpen](functions/signVirtualChannelOpen.md)
- [verifyFactorySettlementSignature](functions/verifyFactorySettlementSignature.md)
- [verifyFactorySignature](functions/verifyFactorySignature.md)
- [verifyVirtualChannelOpenSignature](functions/verifyVirtualChannelOpenSignature.md)
