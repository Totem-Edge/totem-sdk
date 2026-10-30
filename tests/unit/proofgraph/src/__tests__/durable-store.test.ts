/**
 * Durable ProofGraphStoragePort tests (RFC-007 G8): CAS-backed head + node
 * reverse index, restart recovery, concurrent-save safety, reopen, corrupt
 * vs not-found separation, and the no-silent-downgrade guard.
 */

import { MemoryStore } from '@totemsdk/storage';
import type { StorageAdapter } from '@totemsdk/core';
import { StorageError } from '@totemsdk/storage/errors';
import { createDurableProofGraphStore } from '../durable-store.js';
import type { ProofGraph } from '../types.js';
import { createProofGraph, addNode, addEdge, buildEdge } from '../graph.js';
import { exportProofGraph, importProofGraph } from '../io.js';

const VOLATILE = { requireAckMode: 'volatile' as const };

function graphWithNodes(...refIds: string[]): ProofGraph {
  let g = createProofGraph({ label: 'test-graph' });
  for (const refId of refIds) g = addNode(g, 'evidence', refId);
  if (refIds.length >= 2) {
    g = addEdge(g, buildEdge('references', `evidence:${refIds[0]}`, `evidence:${refIds[1]}`));
  }
  return g;
}

describe('createDurableProofGraphStore', () => {
  it('rejects a non-CAS adapter at construction', () => {
    const plain = { async get() { return null; }, async set() {}, async remove() { return true; }, async keys() { return []; }, async has() { return false; }, async clear() {} } as unknown as StorageAdapter;
    expect(() => createDurableProofGraphStore(plain)).toThrow(/CAS-capable storage adapter/);
  });

  it('rejects a low-durability adapter when durable ack is required (no silent downgrade)', () => {
    const store = new MemoryStore();
    expect(() => createDurableProofGraphStore(store)).toThrow(/acknowledges "volatile"/);
  });

  it('save → load round-trip', async () => {
    const store = new MemoryStore();
    const durable = createDurableProofGraphStore(store, VOLATILE);

    const g1 = graphWithNodes('r1', 's1');
    await durable.save(g1);

    const loaded = await durable.load(g1.graphId);
    expect(loaded?.graphId).toBe(g1.graphId);
    expect(loaded?.nodes.length).toBe(g1.nodes.length);
  });

  it('load unknown graphId → null', async () => {
    const store = new MemoryStore();
    const durable = createDurableProofGraphStore(store, VOLATILE);
    expect(await durable.load('no-such-id')).toBeNull();
  });

  it('latest() returns head, null when empty', async () => {
    const store = new MemoryStore();
    const durable = createDurableProofGraphStore(store, VOLATILE);
    expect(await durable.latest()).toBeNull();

    const g1 = graphWithNodes('h1');
    await durable.save(g1);
    expect((await durable.latest())?.graphId).toBe(g1.graphId);
  });

  it('findByNodeId returns latest graph containing the node', async () => {
    const store = new MemoryStore();
    const durable = createDurableProofGraphStore(store, VOLATILE);

    const g1 = graphWithNodes('find1');
    await durable.save(g1);
    const found = await durable.findByNodeId('evidence:find1');
    expect(found?.graphId).toBe(g1.graphId);
  });

  it('multiple saves → head tracks the latest (newest savedAt)', async () => {
    const store = new MemoryStore();
    const durable = createDurableProofGraphStore(store, VOLATILE);

    const g1 = graphWithNodes('m1');
    const g2 = graphWithNodes('m2');
    await durable.save(g1);
    await durable.save(g2);
    expect((await durable.latest())?.graphId).toBe(g2.graphId);
  });

  it('reopen: new store instance over shared adapter loads persisted data', async () => {
    const store = new MemoryStore();
    const first = createDurableProofGraphStore(store, VOLATILE);
    const g1 = graphWithNodes('ro1');
    await first.save(g1);

    const second = createDurableProofGraphStore(store, VOLATILE);
    expect((await second.latest())?.graphId).toBe(g1.graphId);
    expect((await second.load(g1.graphId))?.graphId).toBe(g1.graphId);
  });

  it('concurrent saves under the same adapter: no graph lost', async () => {
    const store = new MemoryStore();
    const durable = createDurableProofGraphStore(store, VOLATILE);

    const g1 = graphWithNodes('con1');
    const g2 = graphWithNodes('con2');
    await Promise.all([durable.save(g1), durable.save(g2)]);
    const ids = await durable.listGraphIds();
    expect(ids).toContain(g1.graphId);
    expect(ids).toContain(g2.graphId);
  });

  it('load corrupt record throws StorageError with code corrupt', async () => {
    const store = new MemoryStore();
    const durable = createDurableProofGraphStore(store, VOLATILE);

    const g1 = graphWithNodes('c1');
    await durable.save(g1);

    const ns = 'totem_proofgraph:v1:';
    await store.set(`${ns}graph:${g1.graphId}`, 'not-valid-json{{{');

    await expect(durable.load(g1.graphId)).rejects.toThrow(StorageError);
    try {
      await durable.load(g1.graphId);
    } catch (err) {
      expect((err as StorageError).code).toBe('corrupt');
    }
  });

  it('recover: head missing → restores head; dangling index cleaned', async () => {
    const store = new MemoryStore();
    const durable = createDurableProofGraphStore(store, VOLATILE);

    const g1 = graphWithNodes('rec1');
    await durable.save(g1);
    const ns = 'totem_proofgraph:v1:';
    await store.remove(`${ns}head`);

    const staleRef = 'totem-proofgraph-evidence:v1:evidence:stale';
    await store.set(`${ns}node:evidence:stale`, { graphId: 'nonexistent', savedAt: 1 });
    await store.set(`${ns}graph:${g1.graphId}`, { json: exportProofGraph(g1), savedAt: Date.now() });

    const report = await durable.recover();
    expect(report.recoveredHead).toBe(true);
    expect(report.cleanedIndexKeys).toBe(1);
    expect((await durable.latest())?.graphId).toBe(g1.graphId);
  });

  it('findByNodeId does not resolve to a graph that does not contain the node', async () => {
    const store = new MemoryStore();
    const durable = createDurableProofGraphStore(store, VOLATILE);

    const g1 = graphWithNodes('x1', 'x2');
    await durable.save(g1);

    const g2 = graphWithNodes('y1');
    await durable.save(g2);

    // x1 is in g1 only → returns g1 (not g2, the newer head).
    expect((await durable.findByNodeId('evidence:x1'))?.graphId).toBe(g1.graphId);

    // y1 is in g2 only → returns g2.
    expect((await durable.findByNodeId('evidence:y1'))?.graphId).toBe(g2.graphId);

    // z1 is in neither graph → null.
    expect(await durable.findByNodeId('evidence:z1')).toBeNull();
  });

  it('dangling node index pointing at missing graph is cleaned by recover', async () => {
    const store = new MemoryStore();
    const durable = createDurableProofGraphStore(store, VOLATILE);
    const ns = 'totem_proofgraph:v1:';

    await store.set(`${ns}node:evidence:orphan`, { graphId: 'missing', savedAt: 1 });
    const report = await durable.recover();
    expect(report.cleanedIndexKeys).toBe(1);
    expect(await store.get(`${ns}node:evidence:orphan`)).toBeNull();
  });
});