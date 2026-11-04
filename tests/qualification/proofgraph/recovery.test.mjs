import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import '../_shared/init-proof-wasm.mjs';
import {
  createProofGraph,
  addNode,
  createDurableProofGraphStore,
} from '../../../packages/proofgraph/dist/index.js';
import { SqliteStore } from '../../../packages/storage/dist/adapters/sqlite-store.js';

const HEAD_KEY = 'totem_proofgraph:v1:head';

function graphFor(ref) {
  return addNode(createProofGraph({ label: 'recovery' }), 'evidence', ref);
}

test('a reopened store recovers the persisted head and every graph', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'proofgraph-recover-'));
  const file = join(dir, 'graphs.sqlite');
  try {
    const first = new SqliteStore(file);
    const writer = createDurableProofGraphStore(first);
    const older = graphFor('older');
    const newest = graphFor('newest');
    await writer.save(older);
    await writer.save(newest);
    await first.close();

    // Simulate a crash that lost the head pointer: recovery must adopt the
    // newest persisted graph instead of returning an empty store.
    const reopened = new SqliteStore(file);
    await reopened.remove(HEAD_KEY);
    const reader = createDurableProofGraphStore(reopened);

    const report = await reader.recover();
    assert.equal(report.recoveredHead, true);
    assert.equal(report.cleanedIndexKeys, 0);

    assert.equal((await reader.latest())?.graphId, newest.graphId);
    assert.equal((await reader.load(older.graphId))?.graphId, older.graphId);
    assert.deepEqual((await reader.listGraphIds()).sort(), [older.graphId, newest.graphId].sort());
    await reopened.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('recovery is idempotent and leaves a healthy store untouched', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'proofgraph-recover2-'));
  const file = join(dir, 'graphs.sqlite');
  try {
    const storage = new SqliteStore(file);
    const store = createDurableProofGraphStore(storage);
    const graph = graphFor('stable');
    await store.save(graph);

    const first = await store.recover();
    const second = await store.recover();
    assert.deepEqual(first, second);
    assert.equal((await store.latest())?.graphId, graph.graphId);
    await storage.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
