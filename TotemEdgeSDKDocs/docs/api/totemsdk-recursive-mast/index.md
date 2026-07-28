**@totemsdk/recursive-mast**

***

# @totemsdk/recursive-mast

## Classes

- [HttpPolicyStore](classes/HttpPolicyStore.md)
- [MemoryPolicyStore](classes/MemoryPolicyStore.md)

## Interfaces

- [AnnouncePolicyConfig](interfaces/AnnouncePolicyConfig.md)
- [AuditConfig](interfaces/AuditConfig.md)
- [AvailabilityPolicy](interfaces/AvailabilityPolicy.md)
- [AvailabilityReceipt](interfaces/AvailabilityReceipt.md)
- [BranchFilter](interfaces/BranchFilter.md)
- [BranchInventory](interfaces/BranchInventory.md)
- [BranchInventoryEntry](interfaces/BranchInventoryEntry.md)
- [ContentKey](interfaces/ContentKey.md)
- [CreateSigningRequestConfig](interfaces/CreateSigningRequestConfig.md)
- [CreateSigningResponseConfig](interfaces/CreateSigningResponseConfig.md)
- [DecryptedBranchResult](interfaces/DecryptedBranchResult.md)
- [EncryptedBranchPackage](interfaces/EncryptedBranchPackage.md)
- [EncryptionEnvelope](interfaces/EncryptionEnvelope.md)
- [EvidenceState](interfaces/EvidenceState.md)
- [ExpectedInput](interfaces/ExpectedInput.md)
- [ExpectedOutput](interfaces/ExpectedOutput.md)
- [HttpStoreOptions](interfaces/HttpStoreOptions.md)
- [KeyWrappingEnvelope](interfaces/KeyWrappingEnvelope.md)
- [MastBranchPackage](interfaces/MastBranchPackage.md)
- [MastBranchSummary](interfaces/MastBranchSummary.md)
- [MemoryStoreOptions](interfaces/MemoryStoreOptions.md)
- [MirrorResult](interfaces/MirrorResult.md)
- [PolicyAction](interfaces/PolicyAction.md)
- [PolicyAvailabilityReport](interfaces/PolicyAvailabilityReport.md)
- [PolicyEndpoint](interfaces/PolicyEndpoint.md)
- [PolicyLookupClient](interfaces/PolicyLookupClient.md)
- [PolicyPathDescriptor](interfaces/PolicyPathDescriptor.md)
- [PolicyQueryResult](interfaces/PolicyQueryResult.md)
- [PolicyRole](interfaces/PolicyRole.md)
- [PolicySignature](interfaces/PolicySignature.md)
- [PolicySigner](interfaces/PolicySigner.md)
- [PolicySignerConfig](interfaces/PolicySignerConfig.md)
- [PolicySigningRequest](interfaces/PolicySigningRequest.md)
- [PolicySigningResponse](interfaces/PolicySigningResponse.md)
- [PolicyUpdateNotification](interfaces/PolicyUpdateNotification.md)
- [QueryPolicyConfig](interfaces/QueryPolicyConfig.md)
- [RecursiveMastPolicyManifest](interfaces/RecursiveMastPolicyManifest.md)
- [RecursiveMastPolicyStore](interfaces/RecursiveMastPolicyStore.md)
- [RequiredRoleState](interfaces/RequiredRoleState.md)
- [ResolvedPolicy](interfaces/ResolvedPolicy.md)
- [ResolvePolicyConfig](interfaces/ResolvePolicyConfig.md)
- [RestrictedBranchPackage](interfaces/RestrictedBranchPackage.md)
- [ScriptDisclosure](interfaces/ScriptDisclosure.md)
- [SignedEvidence](interfaces/SignedEvidence.md)
- [SignedIdentityClaim](interfaces/SignedIdentityClaim.md)
- [SigningRoundResult](interfaces/SigningRoundResult.md)
- [SigningSession](interfaces/SigningSession.md)
- [SigningSessionConfig](interfaces/SigningSessionConfig.md)
- [WatchPolicyConfig](interfaces/WatchPolicyConfig.md)

## Type Aliases

- [BlockDuration](type-aliases/BlockDuration.md)
- [BlockHeight](type-aliases/BlockHeight.md)
- [EncodingDomain](type-aliases/EncodingDomain.md)
- [EncryptionAlgorithm](type-aliases/EncryptionAlgorithm.md)
- [PolicyNode](type-aliases/PolicyNode.md)
- [SigningDomain](type-aliases/SigningDomain.md)
- [SigningSessionStatus](type-aliases/SigningSessionStatus.md)
- [UnixTimeMs](type-aliases/UnixTimeMs.md)
- [UnixTimeSec](type-aliases/UnixTimeSec.md)

## Variables

- [CANONICAL\_ENCODING\_VERSION](variables/CANONICAL_ENCODING_VERSION.md)
- [ENCRYPTION\_ALGORITHMS](variables/ENCRYPTION_ALGORITHMS.md)
- [ENVELOPE\_VERSION](variables/ENVELOPE_VERSION.md)
- [KEY\_PREFIX](variables/KEY_PREFIX.md)

## Functions

- [acceptResponse](functions/acceptResponse.md)
- [advanceSession](functions/advanceSession.md)
- [announcePolicy](functions/announcePolicy.md)
- [asBlockDuration](functions/asBlockDuration.md)
- [asBlockHeight](functions/asBlockHeight.md)
- [asUnixTimeMs](functions/asUnixTimeMs.md)
- [asUnixTimeSec](functions/asUnixTimeSec.md)
- [auditPolicyAvailability](functions/auditPolicyAvailability.md)
- [branchSummary](functions/branchSummary.md)
- [buildAcceptanceScript](functions/buildAcceptanceScript.md)
- [buildBidirectionalBridge](functions/buildBidirectionalBridge.md)
- [buildCrossDomainBridge](functions/buildCrossDomainBridge.md)
- [buildDelegationChain](functions/buildDelegationChain.md)
- [buildDelegationLink](functions/buildDelegationLink.md)
- [buildDelegationScript](functions/buildDelegationScript.md)
- [buildMigrationPath](functions/buildMigrationPath.md)
- [buildMigrationScript](functions/buildMigrationScript.md)
- [buildMigrationStep](functions/buildMigrationStep.md)
- [buildRecursiveWitnessPlan](functions/buildRecursiveWitnessPlan.md)
- [buildTrustNetwork](functions/buildTrustNetwork.md)
- [bundleKey](functions/bundleKey.md)
- [cancelSession](functions/cancelSession.md)
- [canonicalHash](functions/canonicalHash.md)
- [canonicalSerialize](functions/canonicalSerialize.md)
- [canonicalSign](functions/canonicalSign.md)
- [canonicalVerify](functions/canonicalVerify.md)
- [collectSigningResponses](functions/collectSigningResponses.md)
- [computeBranchInventoryHash](functions/computeBranchInventoryHash.md)
- [computeBundleHash](functions/computeBundleHash.md)
- [computeKeyFingerprint](functions/computeKeyFingerprint.md)
- [computePolicyPackageHash](functions/computePolicyPackageHash.md)
- [computeScriptHash](functions/computeScriptHash.md)
- [confirmSession](functions/confirmSession.md)
- [createAvailabilityReceipt](functions/createAvailabilityReceipt.md)
- [createBranchPackage](functions/createBranchPackage.md)
- [createEncryptedBranch](functions/createEncryptedBranch.md)
- [createEncryptionEnvelope](functions/createEncryptionEnvelope.md)
- [createKeyWrappingEnvelope](functions/createKeyWrappingEnvelope.md)
- [createSigningRequest](functions/createSigningRequest.md)
- [createSigningResponse](functions/createSigningResponse.md)
- [createSigningSession](functions/createSigningSession.md)
- [decryptBranch](functions/decryptBranch.md)
- [deserializeBranchPackage](functions/deserializeBranchPackage.md)
- [deserializeEncryptionEnvelope](functions/deserializeEncryptionEnvelope.md)
- [deserializeKeyWrappingEnvelope](functions/deserializeKeyWrappingEnvelope.md)
- [encryptedBranchPublicMetadata](functions/encryptedBranchPublicMetadata.md)
- [getActivePolicyRoot](functions/getActivePolicyRoot.md)
- [getBranchesByAction](functions/getBranchesByAction.md)
- [getBranchesByRole](functions/getBranchesByRole.md)
- [getCriticalBranches](functions/getCriticalBranches.md)
- [getRecoveryBranches](functions/getRecoveryBranches.md)
- [isEncryptedBranch](functions/isEncryptedBranch.md)
- [isMigrationActive](functions/isMigrationActive.md)
- [isMigrationComplete](functions/isMigrationComplete.md)
- [nowMs](functions/nowMs.md)
- [nowSec](functions/nowSec.md)
- [parseContentKey](functions/parseContentKey.md)
- [policyManifestKey](functions/policyManifestKey.md)
- [proofKey](functions/proofKey.md)
- [queryPolicies](functions/queryPolicies.md)
- [receiptCoversBranch](functions/receiptCoversBranch.md)
- [receiptCoversInventory](functions/receiptCoversInventory.md)
- [recordEvidence](functions/recordEvidence.md)
- [resolvePolicyForSubject](functions/resolvePolicyForSubject.md)
- [scriptKey](functions/scriptKey.md)
- [serializeBranchPackage](functions/serializeBranchPackage.md)
- [serializeEncryptionEnvelope](functions/serializeEncryptionEnvelope.md)
- [serializeKeyWrappingEnvelope](functions/serializeKeyWrappingEnvelope.md)
- [sessionSummary](functions/sessionSummary.md)
- [signAvailabilityReceipt](functions/signAvailabilityReceipt.md)
- [signPolicyManifest](functions/signPolicyManifest.md)
- [splitPolicyManifest](functions/splitPolicyManifest.md)
- [submitSession](functions/submitSession.md)
- [toDelegationChainScript](functions/toDelegationChainScript.md)
- [toMigrationPathScript](functions/toMigrationPathScript.md)
- [unixTimeMsToSec](functions/unixTimeMsToSec.md)
- [unixTimeSecToMs](functions/unixTimeSecToMs.md)
- [validateInventoryCoverage](functions/validateInventoryCoverage.md)
- [verifyAvailabilityReceipt](functions/verifyAvailabilityReceipt.md)
- [~~verifyBranchPackage~~](functions/verifyBranchPackage.md)
- [verifyDelegationChain](functions/verifyDelegationChain.md)
- [verifySigningRequest](functions/verifySigningRequest.md)
- [watchPolicy](functions/watchPolicy.md)

## References

### buildEpochAdvancementScript

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### buildLayeredMastScript

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### buildLayeredPolicy

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### buildLayerSubset

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### buildPolicyAnchorScript

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### buildPolicyAnchorState

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### buildPolicyTree

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### buildPrevStateWorkflow

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### buildProofChain

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### buildRootRotationScript

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### buildStateTransition

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### CompiledMast

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### CompiledPolicyNode

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### CompiledRecursivePolicy

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### compileMastTree

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### compilePolicyGraph

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### computeCanonicalScriptAddress

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### computeCanonicalScriptHash

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### counterWorkflow

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### findPolicyNode

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### getPolicyLeaves

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### getPolicyPath

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### LayeredPolicyConfig

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### MinimaScriptProof

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### PolicyAnchorConfig

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### PolicyDelegationEdge

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### PolicyGraph

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### PolicyGraphNode

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### PolicyLayer

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### PolicyNodeInput

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### PolicyTree

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### PrevStateWorkflow

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### ProofChain

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### ProofLink

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### roundBasedWorkflow

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### STANDARD\_LAYERS

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### StateTransition

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### timelockWorkflow

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### toMinimaProofExpression

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### toNestedMastScript

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### toProofExpression

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### toTotemProofExpression

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### VerificationResult

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### verifyProofChain

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### verifyScriptMembership

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)

***

### vestingWorkflow

Renames and re-exports [PolicyNode](type-aliases/PolicyNode.md)
