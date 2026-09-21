**@totemsdk/wots-lease**

***

**Maturity: v1**

# @totemsdk/wots-lease

## Classes

- [AxiaLeaseProvider](classes/AxiaLeaseProvider.md)
- [DeviceRangeViolationError](classes/DeviceRangeViolationError.md)
- [HybridLeaseProvider](classes/HybridLeaseProvider.md)
- [IndicesUnavailableError](classes/IndicesUnavailableError.md)
- [LeaseJournal](classes/LeaseJournal.md)
- [LeaseNotFoundError](classes/LeaseNotFoundError.md)
- [LocalLeaseProvider](classes/LocalLeaseProvider.md)
- [OnchainWatermarkError](classes/OnchainWatermarkError.md)
- [OnchainWatermarkNotImplementedError](classes/OnchainWatermarkNotImplementedError.md)
- [OnchainWatermarkProvider](classes/OnchainWatermarkProvider.md)
- [P2PQuorumLeaseProvider](classes/P2PQuorumLeaseProvider.md)
- [P2PQuorumNotImplementedError](classes/P2PQuorumNotImplementedError.md)
- [PersonalLeaseNodeNotConfiguredError](classes/PersonalLeaseNodeNotConfiguredError.md)
- [PersonalLeaseNodeProvider](classes/PersonalLeaseNodeProvider.md)
- [QuorumConflictError](classes/QuorumConflictError.md)
- [QuorumUnavailableError](classes/QuorumUnavailableError.md)
- [WatermarkExhaustedError](classes/WatermarkExhaustedError.md)
- [WatermarkMonotonicityError](classes/WatermarkMonotonicityError.md)
- [WotsWatermarkStore](classes/WotsWatermarkStore.md)

## Interfaces

- [AxiaLeaseProviderConfig](interfaces/AxiaLeaseProviderConfig.md)
- [CertificateSigner](interfaces/CertificateSigner.md)
- [ConflictRecord](interfaces/ConflictRecord.md)
- [DeviceKeyRange](interfaces/DeviceKeyRange.md)
- [HybridLeaseProviderConfig](interfaces/HybridLeaseProviderConfig.md)
- [JournalEntry](interfaces/JournalEntry.md)
- [LeaseCertificate](interfaces/LeaseCertificate.md)
- [LeaseReservation](interfaces/LeaseReservation.md)
- [LocalWatermark](interfaces/LocalWatermark.md)
- [OnchainWatermarkProviderConfig](interfaces/OnchainWatermarkProviderConfig.md)
- [P2PQuorumLeaseProviderConfig](interfaces/P2PQuorumLeaseProviderConfig.md)
- [PersonalLeaseNodeConfig](interfaces/PersonalLeaseNodeConfig.md)
- [QuorumAttestation](interfaces/QuorumAttestation.md)
- [QuorumPeer](interfaces/QuorumPeer.md)
- [ReserveParams](interfaces/ReserveParams.md)
- [SigningIndices](interfaces/SigningIndices.md)
- [SyncResult](interfaces/SyncResult.md)
- [TreeWatermark](interfaces/TreeWatermark.md)
- [WotsLeaseProvider](interfaces/WotsLeaseProvider.md)
- [WotsWatermarkState](interfaces/WotsWatermarkState.md)

## Type Aliases

- [LeaseStatus](type-aliases/LeaseStatus.md)
- [UnavailableReason](type-aliases/UnavailableReason.md)

## Functions

- [allocateDeviceRange](functions/allocateDeviceRange.md)
- [deviceSlotForAddressIndex](functions/deviceSlotForAddressIndex.md)
- [flatIndex](functions/flatIndex.md)
- [fromFlatIndex](functions/fromFlatIndex.md)

## References

### ChainWatermarkProvider

Renames and re-exports [OnchainWatermarkProvider](classes/OnchainWatermarkProvider.md)

***

### QuorumLeaseProvider

Renames and re-exports [P2PQuorumLeaseProvider](classes/P2PQuorumLeaseProvider.md)
