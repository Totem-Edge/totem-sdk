**@totemsdk/omnia-host**

***

**Maturity: rc**

# @totemsdk/omnia-host

## Classes

- [DisabledAnalyticsStore](classes/DisabledAnalyticsStore.md)
- [DisabledObservationStore](classes/DisabledObservationStore.md)
- [DuckDbAnalyticsStore](classes/DuckDbAnalyticsStore.md)
- [GoRoutingProvider](classes/GoRoutingProvider.md)
- [InProcessRoutingProvider](classes/InProcessRoutingProvider.md)
- [JsonFileStorageAdapter](classes/JsonFileStorageAdapter.md)
- [MemoryMfaReplayGuard](classes/MemoryMfaReplayGuard.md)
- [ObservationBus](classes/ObservationBus.md)
- [ObservationEmitter](classes/ObservationEmitter.md)
- [OperationStore](classes/OperationStore.md)
- [SqliteAuditStore](classes/SqliteAuditStore.md)
- [SqliteChannelStore](classes/SqliteChannelStore.md)

## Interfaces

- [AnalyticsEvent](interfaces/AnalyticsEvent.md)
- [AnalyticsStore](interfaces/AnalyticsStore.md)
- [ConfirmationOptions](interfaces/ConfirmationOptions.md)
- [DuckDbConnection](interfaces/DuckDbConnection.md)
- [EmitObservationInput](interfaces/EmitObservationInput.md)
- [HostApiContext](interfaces/HostApiContext.md)
- [HostIdentity](interfaces/HostIdentity.md)
- [HostIdentityAndManifest](interfaces/HostIdentityAndManifest.md)
- [HostSigning](interfaces/HostSigning.md)
- [MfaAssertion](interfaces/MfaAssertion.md)
- [MfaChallenge](interfaces/MfaChallenge.md)
- [MfaReplayGuard](interfaces/MfaReplayGuard.md)
- [MfaVerificationOptions](interfaces/MfaVerificationOptions.md)
- [MfaVerificationResult](interfaces/MfaVerificationResult.md)
- [ObservationEmitterConfig](interfaces/ObservationEmitterConfig.md)
- [ObservationEntity](interfaces/ObservationEntity.md)
- [ObservationSnapshot](interfaces/ObservationSnapshot.md)
- [ObservationSnapshotInput](interfaces/ObservationSnapshotInput.md)
- [ObservationSnapshotState](interfaces/ObservationSnapshotState.md)
- [ObservationStore](interfaces/ObservationStore.md)
- [ObserveSnapshot](interfaces/ObserveSnapshot.md)
- [OmniaHost](interfaces/OmniaHost.md)
- [OmniaHostConfig](interfaces/OmniaHostConfig.md)
- [OmniaObservation](interfaces/OmniaObservation.md)
- [OperationRecord](interfaces/OperationRecord.md)
- [RouteQuery](interfaces/RouteQuery.md)
- [RoutingProvider](interfaces/RoutingProvider.md)
- [SignerAuditEntry](interfaces/SignerAuditEntry.md)
- [SignerAuditRecord](interfaces/SignerAuditRecord.md)
- [SignerPolicy](interfaces/SignerPolicy.md)
- [SqliteObservationStoreOptions](interfaces/SqliteObservationStoreOptions.md)
- [TotemNodeAdapter](interfaces/TotemNodeAdapter.md)
- [TotemNodeAdapterOptions](interfaces/TotemNodeAdapterOptions.md)
- [TotpOptions](interfaces/TotpOptions.md)

## Type Aliases

- [ObservationDomain](type-aliases/ObservationDomain.md)
- [ObservationEntityType](type-aliases/ObservationEntityType.md)
- [ObservationListener](type-aliases/ObservationListener.md)
- [ObservationPhase](type-aliases/ObservationPhase.md)
- [ObservationRecord](type-aliases/ObservationRecord.md)
- [OperationStatus](type-aliases/OperationStatus.md)
- [OperationStoreLike](type-aliases/OperationStoreLike.md)

## Functions

- [assertMfaAssertion](functions/assertMfaAssertion.md)
- [channelTransitionHash](functions/channelTransitionHash.md)
- [createAuditRecorder](functions/createAuditRecorder.md)
- [createHostIdentityAndManifest](functions/createHostIdentityAndManifest.md)
- [createHostManifest](functions/createHostManifest.md)
- [createHostMethods](functions/createHostMethods.md)
- [createHostSigning](functions/createHostSigning.md)
- [createLocalSignerPort](functions/createLocalSignerPort.md)
- [createMemoryObservationStore](functions/createMemoryObservationStore.md)
- [createObservationSnapshot](functions/createObservationSnapshot.md)
- [createOmniaHost](functions/createOmniaHost.md)
- [createPolicySignerPort](functions/createPolicySignerPort.md)
- [createSqliteObservationStore](functions/createSqliteObservationStore.md)
- [createTotemNodeAdapter](functions/createTotemNodeAdapter.md)
- [encryptSeedForKeyfile](functions/encryptSeedForKeyfile.md)
- [generateTotp](functions/generateTotp.md)
- [hashString](functions/hashString.md)
- [hashTransition](functions/hashTransition.md)
- [hasSigningMaterial](functions/hasSigningMaterial.md)
- [initializeDuckDb](functions/initializeDuckDb.md)
- [leaseStorageDir](functions/leaseStorageDir.md)
- [loadConfigFromEnv](functions/loadConfigFromEnv.md)
- [loadHostIdentity](functions/loadHostIdentity.md)
- [mfaOperationHash](functions/mfaOperationHash.md)
- [verifyMfaAssertion](functions/verifyMfaAssertion.md)
- [verifyTotp](functions/verifyTotp.md)
