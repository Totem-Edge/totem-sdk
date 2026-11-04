import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import '../_shared/init-proof-wasm.mjs';
import {
  createProofGraph,
  addNode,
  addEdge,
  buildEdge,
  createDurableProofGraphStore,
  verifyProofGraph,
} from '../../../packages/proofgraph/dist/index.js';
import { SqliteStore } from '../../../packages/storage/dist/adapters/sqlite-store.js';

function graphWithEvidence(...refs) {
  let graph = createProofGraph({ label: 'integration' });
  for (const ref of refs) graph = addNode(graph, 'evidence', ref);
  if (refs.length >= 2) graph = addEdge(graph, buildEdge('references', `evidence:${refs[0]}`, `evidence:${refs[1]}`));
  return graph;
}

test('durable proof graphs persist over the SQLite CAS adapter', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'proofgraph-int-'));
  const file = join(dir, 'graphs.sqlite');
  try {
    const storage = new SqliteStore(file);
    const store = createDurableProofGraphStore(storage);

    const first = graphWithEvidence('a', 'b');
    const second = graphWithEvidence('c');
    await store.save(first);
    await store.save(second);

    assert.deepEqual(await store.listGraphIds(), [first.graphId, second.graphId]);
    const latest = await store.latest();
    assert.equal(latest?.graphId, second.graphId);

    const loaded = await store.load(first.graphId);
    assert.equal(loaded?.graphId, first.graphId);
    assert.equal(loaded?.nodes.length, first.nodes.length);
    assert.equal(verifyProofGraph(loaded).valid, true);
    await storage.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('concurrent saves are serialized and never clobber the head', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'proofgraph-race-'));
  const file = join(dir, 'graphs.sqlite');
  try {
    const storage = new SqliteStore(file);
    const store = createDurableProofGraphStore(storage);
    const graphs = [graphWithEvidence('r1'), graphWithEvidence('r2'), graphWithEvidence('r3')];

    await Promise.all(graphs.map((graph) => store.save(graph)));

    const ids = await store.listGraphIds();
    assert.equal(ids.length, graphs.length);
    for (const graph of graphs) {
      assert.ok(ids.includes(graph.graphId));
      assert.equal((await store.load(graph.graphId))?.graphId, graph.graphId);
    }
    await storage.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
