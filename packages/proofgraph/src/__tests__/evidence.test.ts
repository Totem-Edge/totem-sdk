/**
 * Durable evidence-chain tests (RFC-007 G8 / §4.3): evidence bytes persist
 * through the minimal ArtifactStore and restore with the exact integrity
 * split — `ok` / `not-found` (bytes absent) / `corrupt` (bytes present but
 * digest mismatch) — never collapsed together.
 */

import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ArtifactStore } from '@totemsdk/storage/artifacts';
import { LocalFileBackend } from '@totemsdk/storage/artifacts/local-fs-backend';
import { MemoryStore } from '@totemsdk/storage';
import { StorageError } from '@totemsdk/storage/errors';
import { createProofGraph, addNode } from '../graph.js';
import { createProofGraphEvidenceStore } from '../evidence.js';
import type { ProofGraph } from '../types.js';

const enc = (s: string): Uint8Array => Buffer.from(s, 'utf8');

function graphWithEvidence(...refIds: string[]): ProofGraph {
  let g = createProofGraph({ label: 'flight-evidence' });
  for (const refId of refIds) g = addNode(g, 'evidence', refId);
  return g;
}

describe('createProofGraphEvidenceStore (artifact-restore contract)', () => {
  let dir: string;
  let artifacts: ArtifactStore;
  let index: MemoryStore;

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), 'totem-pg-evidence-'));
    artifacts = new ArtifactStore(new LocalFileBackend(dir));
    index = new MemoryStore();
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('putEvidence + restoreEvidence round-trips the drone-flight evidence chain (raster→spatial→location→integritas)', async () => {
    const store = createProofGraphEvidenceStore(artifacts, index);
    const flightBytes = new Map([
      ['evidence:raster:df1', enc('raster-frame-1201')],
      ['evidence:spatial:df1', enc('spatial-wkt-POLYGON(...)')],
      ['evidence:location:df1', enc('location-lla-51.5,-0.1,120')],
      ['evidence:integritas:df1', enc('integritas-manifest-hash')],
    ]);
    const graph = graphWithEvidence('raster:df1', 'spatial:df1', 'location:df1', 'integritas:df1');

    const refs = await store.putEvidence(graph, (nodeId) => flightBytes.get(nodeId));

    expect(refs).toHaveLength(4);
    expect(await store.listCount()).toBe(4);

    const restored = await store.restoreEvidence(graph);
    expect(restored.map((r) => r.status)).toEqual(['ok', 'ok', 'ok', 'ok']);
    expect(restored.map((r) => Buffer.from(r.bytes!).toString())).toEqual([
      'raster-frame-1201',
      'spatial-wkt-POLYGON(...)',
      'location-lla-51.5,-0.1,120',
      'integritas-manifest-hash',
    ]);
  });

  it('nodes with no stored bytes restore as not-found', async () => {
    const store = createProofGraphEvidenceStore(artifacts, index);
    const graph = graphWithEvidence('raster:unrecorded');
    const restored = await store.restoreEvidence(graph);
    expect(restored).toEqual([
      expect.objectContaining({ nodeId: 'evidence:raster:unrecorded', status: 'not-found' }),
    ]);
  });

  it('artifact bytes deleted from the backend restore as not-found (exact split from corrupt)', async () => {
    const store = createProofGraphEvidenceStore(artifacts, index, { strict: false });
    const graph = graphWithEvidence('spatial:gone');

    await store.putEvidence(graph, () => enc('spatial-bytes-gone'));
    // Delete the artifact file directly (backend-level removal).
    for (const f of await fs.readdir(dir)) {
      if (f.endsWith('.art')) {
        await fs.unlink(join(dir, f));
      }
    }

    const restored = await store.restoreEvidence(graph);
    expect(restored).toEqual([
      expect.objectContaining({ nodeId: 'evidence:spatial:gone', status: 'not-found' }),
    ]);
  });

  it('tampered artifact bytes restore as corrupt — distinct from not-found', async () => {
    const store = createProofGraphEvidenceStore(artifacts, index, { strict: false });
    const graph = graphWithEvidence('integritas:proof-1', 'raster:ok-1', 'raster:missing-1');

    await store.putEvidence(graph, (nodeId) =>
      nodeId === 'evidence:integritas:proof-1' ? enc('integritas-bytes')
        : nodeId === 'evidence:raster:ok-1' ? enc('raster-bytes-ok')
        : enc('raster-bytes-missing'));

    // Tamper only the integritas artifact file (flip bytes in place).
    let tampered = false;
    for (const f of await fs.readdir(dir)) {
      if (f.endsWith('.art') && !tampered) {
        const path = join(dir, f);
        // Identify the integritas file by its stored digest: read index record.
        const entry = await index.get<{ ref: { digest: string } }>('totem_proofgraph_evidence:v1:evidence:integritas:proof-1');
        if (entry && f.includes(entry.ref.digest)) {
          const bytes = await fs.readFile(path);
          bytes[0] = bytes[0] === 0 ? 1 : 0;
          await fs.writeFile(path, bytes);
          tampered = true;
        }
      }
    }
    // Delete the missing raster artifact file entirely.
    const missingEntry = await index.get<{ ref: { digest: string } }>('totem_proofgraph_evidence:v1:evidence:raster:missing-1');
    if (missingEntry) {
      const missingFile = join(dir, `${Buffer.from('totem-proofgraph-evidence').toString('hex')}.${missingEntry.ref.digest}.art`);
      await fs.rm(missingFile, { force: true });
    }

    const restored = await store.restoreEvidence(graph);
    const byId = new Map(restored.map((r) => [r.nodeId, r.status]));
    expect(byId.get('evidence:integritas:proof-1')).toBe('corrupt');
    expect(byId.get('evidence:raster:ok-1')).toBe('ok');
    expect(byId.get('evidence:raster:missing-1')).toBe('not-found');
  });

  it('strict mode: corrupt evidence read throws StorageError(s) code=corrupt', async () => {
    const store = createProofGraphEvidenceStore(artifacts, index, { strict: true });
    const graph = graphWithEvidence('integritas:corrupt-1');
    await store.putEvidence(graph, () => enc('integritas-bytes'));

    // Tamper the artifact file.
    const entry = await index.get<{ ref: { digest: string } }>('totem_proofgraph_evidence:v1:evidence:integritas:corrupt-1');
    const file = join(dir, `${Buffer.from('totem-proofgraph-evidence').toString('hex')}.${entry!.ref.digest}.art`);
    const bytes = await fs.readFile(file);
    bytes[0] = bytes[0] === 0 ? 1 : 0;
    await fs.writeFile(file, bytes);

    await expect(store.restoreEvidence(graph)).rejects.toThrow(StorageError);
    try {
      await store.restoreEvidence(graph);
    } catch (err) {
      expect((err as StorageError).code).toBe('corrupt');
    }
  });

  it('rejects a read-only artifact store at construction', () => {
    const readOnly = {
      capabilities: { writable: false, acknowledge: 'durably-acknowledged', atomic: true, retention: 'managed', offlineReadable: true },
      async put() { throw new Error('read-only'); },
      async get() { return { status: 'not-found' as const }; },
    };
    expect(() => createProofGraphEvidenceStore(readOnly as unknown as ArtifactStore, index)).toThrow(/writable artifact store/);
  });
});