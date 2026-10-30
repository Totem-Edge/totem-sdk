import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha3_256, toHex } from '@totemsdk/core';
import { ArtifactStore } from '@totemsdk/storage/artifacts';
import { LocalFileBackend } from '@totemsdk/storage/artifacts/local-fs-backend';
import { codec } from '@totemsdk/storage/codec';
import { defineDataset } from '@totemsdk/replication';
import { HyperbeeDistributedIndex } from '../hyperbee-index.js';
import { createReplicatedEvidenceNetwork } from '../proofgraph-evidence-network.js';

const descriptor = defineDataset({
  datasetId: 'test.evidence-index',
  datasetVersion: 1,
  codecVersion: codec.version,
  writerModel: 'multi-writer',
  encryptionProfile: 'none',
  retention: 'full',
});

describe('replicated proofgraph evidence network', () => {
  let dir: string;
  let artifacts: ArtifactStore;
  let index: HyperbeeDistributedIndex;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'totem-evidence-net-'));
    artifacts = new ArtifactStore(new LocalFileBackend(join(dir, 'artifacts')));
    index = await HyperbeeDistributedIndex.open({
      storagePath: join(dir, 'index'),
      descriptor,
    });
  });

  afterEach(async () => {
    await index.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('stores, indexes and independently re-verifies evidence', async () => {
    const bytes = new TextEncoder().encode('sensor-evidence');
    const contentHash = toHex(sha3_256(bytes));
    const network = createReplicatedEvidenceNetwork({ artifacts, index });

    const refs = await network.putEvidence(
      { nodes: [{ id: 'e1', type: 'evidence', data: { contentHash } }] },
      () => bytes,
    );
    expect(refs).toHaveLength(1);
    const read = await network.getEvidence('e1');
    expect(read.status).toBe('ok');
    expect(read.bytes).toEqual(bytes);
    expect(await network.verifyEvidence('e1')).toBe(true);
  });

  it('rejects a commitment mismatch before indexing', async () => {
    const network = createReplicatedEvidenceNetwork({ artifacts, index });
    await expect(
      network.putEvidence(
        { nodes: [{ id: 'e1', type: 'evidence', data: { contentHash: 'deadbeef' } }] },
        () => new TextEncoder().encode('different'),
      ),
    ).rejects.toMatchObject({ code: 'corrupt' });
    expect(await network.getEvidence('e1')).toMatchObject({ status: 'not-found' });
  });

  it('returns corrupt when the indexed artifact is substituted', async () => {
    const bytes = new TextEncoder().encode('original');
    const contentHash = toHex(sha3_256(bytes));
    const network = createReplicatedEvidenceNetwork({ artifacts, index });
    await network.putEvidence(
      { nodes: [{ id: 'e1', type: 'evidence', data: { contentHash } }] },
      () => bytes,
    );
    const entry = (await index.get('proofgraph:evidence:e1')) as { ref: any };
    const replacement = new TextEncoder().encode('substituted');
    await artifacts.put(entry.ref.namespace, replacement);
    // Same digest address cannot hold different bytes; corrupt the stored file
    // through a fresh ref whose index entry points at it.
    const other = await artifacts.put(entry.ref.namespace, replacement);
    await index.put('proofgraph:evidence:e1', {
      nodeId: 'e1', ref: other.ref, contentHash, storedAt: Date.now(),
    });
    expect((await network.getEvidence('e1')).status).toBe('corrupt');
  });
});
