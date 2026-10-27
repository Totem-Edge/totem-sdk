/** Versioned dataset descriptors and codec helpers (RFC-057 §4.1). */

import { codec } from '@totemsdk/storage/codec';

export const REPLICATION_DATASET_FORMAT = 1;

export type WriterModel = 'single-writer' | 'multi-writer' | 'read-replica';

export interface DatasetDescriptor {
  readonly datasetId: string;
  readonly datasetVersion: number;
  /** Versioned Totem codec version (not raw JSON). */
  readonly codecVersion: number;
  readonly writerModel: WriterModel;
  readonly writerSetRef?: string;
  readonly encryptionProfile: 'none' | string;
  readonly retention: 'full' | 'sparse' | 'bounded';
  readonly migration?: { readonly fromVersion: number; readonly rule: string };
}

export interface DatasetEnvelope<T = unknown> {
  readonly datasetId: string;
  readonly datasetVersion: number;
  readonly record: T;
}

export function defineDataset(descriptor: DatasetDescriptor): DatasetDescriptor {
  if (!descriptor.datasetId) throw new Error('replication: datasetId is required');
  if (!Number.isInteger(descriptor.datasetVersion) || descriptor.datasetVersion < 1) {
    throw new Error('replication: datasetVersion must be a positive integer');
  }
  if (descriptor.codecVersion !== codec.version) {
    throw new Error(
      `replication: dataset codec version ${descriptor.codecVersion} does not match this build (${codec.version})`,
    );
  }
  return Object.freeze({ ...descriptor });
}

/** Reject unknown dataset versions rather than best-effort parsing. */
export function assertCompatibleDataset(expected: DatasetDescriptor, incoming: DatasetDescriptor): void {
  if (expected.datasetId !== incoming.datasetId) throw new Error('replication: dataset id mismatch');
  if (incoming.datasetVersion !== expected.datasetVersion) {
    throw new Error(
      `replication: unsupported dataset version ${incoming.datasetVersion} (expected ${expected.datasetVersion})`,
    );
  }
  if (incoming.codecVersion !== expected.codecVersion) {
    throw new Error(`replication: unsupported codec version ${incoming.codecVersion}`);
  }
}

export function encodeReplicationRecord<T>(descriptor: DatasetDescriptor, record: T): Uint8Array {
  return codec.serialize({
    datasetId: descriptor.datasetId,
    datasetVersion: descriptor.datasetVersion,
    record,
  } satisfies DatasetEnvelope<T>);
}

export function decodeReplicationRecord<T>(
  descriptor: DatasetDescriptor,
  bytes: Uint8Array,
): T {
  const envelope = codec.deserialize(bytes) as DatasetEnvelope<T> | null;
  if (!envelope || typeof envelope !== 'object') {
    throw new Error('replication: invalid record envelope');
  }
  assertCompatibleDataset(descriptor, {
    ...descriptor,
    datasetId: envelope.datasetId,
    datasetVersion: envelope.datasetVersion,
  });
  return envelope.record;
}
