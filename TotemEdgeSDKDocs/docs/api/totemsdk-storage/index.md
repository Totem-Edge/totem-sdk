**@totemsdk/storage**

***

**Maturity: rc**

# @totemsdk/storage

## Classes

- [ArtifactStore](classes/ArtifactStore.md)
- [MemoryStore](classes/MemoryStore.md)
- [Namespace](classes/Namespace.md)
- [StorageError](classes/StorageError.md)

## Interfaces

- [ArtifactBackendCapabilities](interfaces/ArtifactBackendCapabilities.md)
- [ArtifactIndexEntry](interfaces/ArtifactIndexEntry.md)
- [ArtifactRead](interfaces/ArtifactRead.md)
- [ArtifactRef](interfaces/ArtifactRef.md)
- [ArtifactStoreBackend](interfaces/ArtifactStoreBackend.md)
- [CasStore](interfaces/CasStore.md)
- [Codec](interfaces/Codec.md)
- [ConditionalResult](interfaces/ConditionalResult.md)
- [EffectivePersistence](interfaces/EffectivePersistence.md)
- [EnqueueReceipt](interfaces/EnqueueReceipt.md)
- [Journal](interfaces/Journal.md)
- [JournalEntry](interfaces/JournalEntry.md)
- [JournalOptions](interfaces/JournalOptions.md)
- [JournalRecoveryReport](interfaces/JournalRecoveryReport.md)
- [PersistencePorts](interfaces/PersistencePorts.md)
- [PersistenceRequirement](interfaces/PersistenceRequirement.md)
- [PersistenceSurfaceGuarantee](interfaces/PersistenceSurfaceGuarantee.md)
- [PutOptions](interfaces/PutOptions.md)
- [PutReceipt](interfaces/PutReceipt.md)
- [RevisionedSnapshotStore](interfaces/RevisionedSnapshotStore.md)
- [RevisionedSnapshotStoreOptions](interfaces/RevisionedSnapshotStoreOptions.md)
- [ScopedStorage](interfaces/ScopedStorage.md)
- [SnapshotRecord](interfaces/SnapshotRecord.md)
- [StorageAdapter](interfaces/StorageAdapter.md)
- [StorageAdapterWithCapabilities](interfaces/StorageAdapterWithCapabilities.md)
- [StorageErrorDetails](interfaces/StorageErrorDetails.md)
- [StorageScope](interfaces/StorageScope.md)
- [StoreCapabilities](interfaces/StoreCapabilities.md)
- [Transaction](interfaces/Transaction.md)
- [TransactionalStore](interfaces/TransactionalStore.md)

## Type Aliases

- [ArtifactReadStatus](type-aliases/ArtifactReadStatus.md)
- [ConditionalUpdateDecision](type-aliases/ConditionalUpdateDecision.md)
- [ConditionalUpdater](type-aliases/ConditionalUpdater.md)
- [FailurePolicy](type-aliases/FailurePolicy.md)
- [StorageErrorCode](type-aliases/StorageErrorCode.md)
- [WriteAckMode](type-aliases/WriteAckMode.md)

## Variables

- [ARTIFACT\_DEFAULT\_ALGORITHM](variables/ARTIFACT_DEFAULT_ALGORITHM.md)
- [codec](variables/codec.md)
- [CODEC\_MAGIC](variables/CODEC_MAGIC.md)
- [CODEC\_VERSION](variables/CODEC_VERSION.md)
- [FailurePolicies](variables/FailurePolicies.md)
- [JOURNAL\_RECORD\_VERSION](variables/JOURNAL_RECORD_VERSION.md)
- [SNAPSHOT\_RECORD\_VERSION](variables/SNAPSHOT_RECORD_VERSION.md)
- [StorageErrorCodes](variables/StorageErrorCodes.md)
- [WriteAckModes](variables/WriteAckModes.md)

## Functions

- [artifactRefId](functions/artifactRefId.md)
- [assertCapabilities](functions/assertCapabilities.md)
- [assertPersistence](functions/assertPersistence.md)
- [asStorageError](functions/asStorageError.md)
- [createJournal](functions/createJournal.md)
- [createRevisionedSnapshotStore](functions/createRevisionedSnapshotStore.md)
- [createScopedStorage](functions/createScopedStorage.md)
- [enqueueItem](functions/enqueueItem.md)
- [isStorageError](functions/isStorageError.md)
- [jsonClean](functions/jsonClean.md)
