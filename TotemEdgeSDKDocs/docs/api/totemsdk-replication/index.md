**@totemsdk/replication**

***

**Maturity: alpha**

# @totemsdk/replication

## Classes

- [EncryptedBackupLog](classes/EncryptedBackupLog.md)

## Interfaces

- [BackupCipher](interfaces/BackupCipher.md)
- [Checkpoint](interfaces/Checkpoint.md)
- [CollaborativeStore](interfaces/CollaborativeStore.md)
- [DatasetDescriptor](interfaces/DatasetDescriptor.md)
- [DatasetEnvelope](interfaces/DatasetEnvelope.md)
- [DistributedCapabilities](interfaces/DistributedCapabilities.md)
- [DistributedFileStore](interfaces/DistributedFileStore.md)
- [DistributedIndex](interfaces/DistributedIndex.md)
- [EncryptedBackupRecord](interfaces/EncryptedBackupRecord.md)
- [ObservedHead](interfaces/ObservedHead.md)
- [ReplicaObservation](interfaces/ReplicaObservation.md)
- [ReplicatedLog](interfaces/ReplicatedLog.md)
- [ReplicatedRead](interfaces/ReplicatedRead.md)
- [ReplicatedReadOptions](interfaces/ReplicatedReadOptions.md)
- [ReplicationStatus](interfaces/ReplicationStatus.md)

## Type Aliases

- [ReplicaFreshness](type-aliases/ReplicaFreshness.md)
- [WriterModel](type-aliases/WriterModel.md)

## Variables

- [REPLICATION\_DATASET\_FORMAT](variables/REPLICATION_DATASET_FORMAT.md)

## Functions

- [assertCompatibleDataset](functions/assertCompatibleDataset.md)
- [computeCheckpointDigest](functions/computeCheckpointDigest.md)
- [createEncryptedBackupRecord](functions/createEncryptedBackupRecord.md)
- [decodeReplicationRecord](functions/decodeReplicationRecord.md)
- [defineDataset](functions/defineDataset.md)
- [encodeReplicationRecord](functions/encodeReplicationRecord.md)
- [readReplicated](functions/readReplicated.md)
- [restoreEncryptedBackupRecord](functions/restoreEncryptedBackupRecord.md)
- [verifyCheckpoint](functions/verifyCheckpoint.md)
