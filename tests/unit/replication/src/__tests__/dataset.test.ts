import { codec } from '@totemsdk/storage/codec';
import {
  assertCompatibleDataset,
  decodeReplicationRecord,
  defineDataset,
  encodeReplicationRecord,
} from '../dataset';

describe('replication dataset descriptors', () => {
  const descriptor = defineDataset({
    datasetId: 'proofgraph.events',
    datasetVersion: 1,
    codecVersion: codec.version,
    writerModel: 'single-writer',
    encryptionProfile: 'none',
    retention: 'full',
  });

  it('rejects unknown dataset versions', () => {
    expect(() => assertCompatibleDataset(descriptor, { ...descriptor, datasetVersion: 2 })).toThrow(/unsupported dataset version/);
  });

  it('round-trips bigint and bytes through the versioned codec', () => {
    const record = { at: 1, amount: 42n, bytes: new Uint8Array([1, 2, 3]) };
    expect(decodeReplicationRecord(descriptor, encodeReplicationRecord(descriptor, record))).toEqual(record);
  });

  it('rejects a record from a different dataset', () => {
    const other = { ...descriptor, datasetId: 'other' };
    const bytes = encodeReplicationRecord(other, { x: 1 });
    expect(() => decodeReplicationRecord(descriptor, bytes)).toThrow(/dataset id mismatch/);
  });
});
