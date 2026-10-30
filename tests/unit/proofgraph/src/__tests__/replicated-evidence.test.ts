import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha3_256, toHex } from '@totemsdk/core';
import { ArtifactStore } from '@totemsdk/storage/artifacts';
import { LocalFileBackend } from '@totemsdk/storage/artifacts/local-fs-backend';
import { createReplicatedProofGraphEvidenceStore } from '../replicated-evidence.js';
import type { ProofGraph } from '../types.js';

describe('replicated proofgraph evidence', () => {
  let dir: string;
  let artifacts: ArtifactStore;
  const data = new Map<string, unknown>();
  const index = {
    get: async (key: string) => data.get(key) ?? null,
    put: async (key: string, value: unknown) => { data.set(key, value); },
    async *list(prefix = '') {
      for (const [key, value] of data) if (key.startsWith(prefix)) yield { key, value };
    },
  };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'totem-replicated-evidence-'));
    artifacts = new ArtifactStore(new LocalFileBackend(join(dir, 'artifacts')));
    data.clear();
  });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  const graph = (id: string, contentHash?: string): ProofGraph => ({
    graphId: 'g1',
    createdAt: 1,
    nodes: [{ id, type: 'evidence', refId: id, createdAt: 1, data: contentHash ? { contentHash } : {} }],
    edges: [],
  });

  it('indexes and independently re-verifies evidence', async () => {
    const bytes = new TextEncoder().encode('proof-bytes');
    const store = createReplicatedProofGraphEvidenceStore({ artifacts, index });
    await store.putEvidence(graph('e1', toHex(sha3_256(bytes))), () => bytes);
    expect(await store.verifyEvidence('e1')).toBe(true);
    for await (const entry of store.listEvidence()) expect(entry.nodeId).toBe('e1');
  });

  it('rejects a commitment mismatch before indexing', async () => {
    const store = createReplicatedProofGraphEvidenceStore({ artifacts, index });
    await expect(store.putEvidence(graph('e1', 'deadbeef'), () => new TextEncoder().encode('other')))
      .rejects.toMatchObject({ code: 'corrupt' });
    expect(await store.getEvidence('e1')).toMatchObject({ status: 'not-found' });
  });

  it('reports corrupt when the indexed artifact is substituted', async () => {
    const bytes = new TextEncoder().encode('original');
    const store = createReplicatedProofGraphEvidenceStore({ artifacts, index });
    await store.putEvidence(graph('e1', toHex(sha3_256(bytes))), () => bytes);
    const entry = data.get('proofgraph:evidence:e1') as { ref: any; contentHash: string };
    const other = await artifacts.put(entry.ref.namespace, new TextEncoder().encode('substituted'));
    data.set('proofgraph:evidence:e1', { ...entry, ref: other.ref });
    expect(await store.getEvidence('e1')).toMatchObject({ status: 'corrupt' });
  });
});
