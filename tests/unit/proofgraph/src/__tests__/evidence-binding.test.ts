/**
 * RFC-007 Amendment A, phase A3: enforced claim → contentHash → artifact binding.
 *
 * Evidence-grade bytes must be recoverable from the committed `contentHash`:
 * the store rejects a mismatched commitment (`corrupt`) and re-checks the
 * commitment→digest binding on restore (index-tamper guard).
 */
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { sha3_256, toHex } from '@totemsdk/core';
import { ArtifactStore } from '@totemsdk/storage/artifacts';
import { LocalFileBackend } from '@totemsdk/storage/artifacts/local-fs-backend';
import { MemoryStore } from '@totemsdk/storage';
import { StorageError } from '@totemsdk/storage/errors';
import { createProofGraph, addNode } from '../graph.js';
import {
  createProofGraphEvidenceStore,
  assertEvidenceBinding,
} from '../evidence.js';
import type { ProofGraph } from '../types.js';

const enc = (s: string): Uint8Array => Buffer.from(s, 'utf8');
const digestOf = (bytes: Uint8Array): string => toHex(sha3_256(bytes));

function graphWithCommittedEvidence(id: string, bytes: Uint8Array, overrideHash?: string): ProofGraph {
  const g = createProofGraph({ label: 'binding' });
  return addNode(g, 'evidence', id, { contentHash: overrideHash ?? digestOf(bytes) });
}

describe('evidence artifact binding (A3)', () => {
  let dir: string;
  let artifacts: ArtifactStore;
  let index: MemoryStore;

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), 'totem-pg-binding-'));
    artifacts = new ArtifactStore(new LocalFileBackend(dir));
    index = new MemoryStore();
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('commitment → resolvable artifact → bytes (round-trip with byte identity)', async () => {
    const store = createProofGraphEvidenceStore(artifacts, index);
    const bytes = enc('original-geotiff-bytes');
    const contentHash = digestOf(bytes);
    const graph = graphWithCommittedEvidence('raster:df1', bytes);

    const refs = await store.putEvidence(graph, () => bytes);
    expect(refs).toHaveLength(1);
    expect(refs[0].digest).toBe(contentHash);

    const [result] = await store.restoreEvidence(graph);
    expect(result.status).toBe('ok');
    expect(result.contentHash).toBe(contentHash);
    expect(toHex(sha3_256(result.bytes!))).toBe(contentHash);
    expect(Buffer.from(result.bytes!).toString()).toBe('original-geotiff-bytes');
  });

  it('rejects a mismatched commitment at write time (corrupt, not silently stored)', async () => {
    const store = createProofGraphEvidenceStore(artifacts, index);
    const bytes = enc('captured-bytes');
    const graph = graphWithCommittedEvidence('raster:bad', bytes, digestOf(enc('different-bytes')));

    await expect(store.putEvidence(graph, () => bytes)).rejects.toMatchObject({
      name: 'StorageError',
      code: 'corrupt',
    });
    // Nothing was indexed.
    expect(await store.listCount()).toBe(0);
  });

  it('requireContentHash enforces a mandatory commitment', async () => {
    const store = createProofGraphEvidenceStore(artifacts, index);
    const graph = addNode(createProofGraph({ label: 'x' }), 'evidence', 'raster:nohash');
    await expect(store.putEvidence(graph, () => enc('bytes'), { requireContentHash: true })).rejects.toMatchObject({
      code: 'corrupt',
    });
  });

  it('rejects a tampered index binding on restore', async () => {
    const store = createProofGraphEvidenceStore(artifacts, index);
    const bytes = enc('evidence-bytes');
    const graph = graphWithCommittedEvidence('integritas:1', bytes);
    await store.putEvidence(graph, () => bytes);

    // Tamper the persisted commitment so contentHash !== artifact.digest.
    const key = 'totem_proofgraph_evidence:v1:evidence:integritas:1';
    const entry = await index.get<{ ref: { digest: string }; contentHash?: string }>(key);
    await index.set(key, { ...entry, contentHash: digestOf(enc('other')) });

    await expect(store.restoreEvidence(graph)).rejects.toMatchObject({
      name: 'StorageError',
      code: 'corrupt',
    });
  });

  it('assertEvidenceBinding is the single binding invariant', () => {
    const ref = { namespace: 'ns', algorithm: 'sha3-256' as const, digest: digestOf(enc('x')) };
    expect(() => assertEvidenceBinding({ nodeId: 'n', contentHash: digestOf(enc('x')), artifact: ref })).not.toThrow();
    expect(() =>
      assertEvidenceBinding({ nodeId: 'n', contentHash: digestOf(enc('y')), artifact: ref }),
    ).toThrow(StorageError);
    // 0x-prefixed commitment is accepted.
    expect(() =>
      assertEvidenceBinding({ nodeId: 'n', contentHash: '0x' + digestOf(enc('x')), artifact: ref }),
    ).not.toThrow();
  });
});
