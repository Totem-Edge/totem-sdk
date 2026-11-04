import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../_shared/init-proof-wasm.mjs';
import {
  createProofGraph,
  addNode,
  addEdge,
  buildEdge,
  recomputeGraphId,
  exportProofGraph,
  importProofGraph,
  getEdgesFrom,
  verifyProofGraph,
} from '../../../packages/proofgraph/dist/index.js';

test('graphId is a deterministic content address', () => {
  const build = () => addEdge(
    addNode(addNode(createProofGraph({ label: 'conf' }), 'evidence', 'a'), 'evidence', 'b'),
    buildEdge('references', 'evidence:a', 'evidence:b'),
  );
  const first = build();
  const second = build();
  assert.equal(first.graphId, second.graphId);
  assert.equal(recomputeGraphId(first), first.graphId);
});

test('mutations are immutable and idempotent', () => {
  const base = createProofGraph();
  const once = addNode(base, 'evidence', 'a');
  const twice = addNode(once, 'evidence', 'a');
  assert.notEqual(base.graphId, once.graphId);
  assert.equal(once.graphId, twice.graphId);
  assert.equal(base.nodes.length, 0);
  assert.equal(twice.nodes.length, 1);
});

test('edges are queryable and validated', () => {
  let graph = createProofGraph();
  graph = addNode(graph, 'evidence', 'a');
  graph = addNode(graph, 'evidence', 'b');
  graph = addEdge(graph, buildEdge('references', 'evidence:a', 'evidence:b'));

  const nodeA = graph.nodes.find((node) => node.id === 'evidence:a');
  const nodeB = graph.nodes.find((node) => node.id === 'evidence:b');
  assert.ok(nodeA && nodeB);
  assert.equal(getEdgesFrom(graph, nodeA.id).length, 1);
  assert.equal(getEdgesFrom(graph, nodeB.id).length, 0);
  assert.ok(graph.edges.some((edge) => edge.type === 'references'));
});

test('export/import preserves the graph id and nodes', () => {
  let graph = createProofGraph({ label: 'round-trip' });
  graph = addNode(graph, 'evidence', 'x');
  graph = addNode(graph, 'identity', 'y');
  const restored = importProofGraph(exportProofGraph(graph));
  assert.equal(restored.graphId, graph.graphId);
  assert.equal(restored.nodes.length, graph.nodes.length);
  assert.equal(verifyProofGraph(restored).valid, true);
});

test('import rejects malformed or tampered graphs', () => {
  const graph = addNode(createProofGraph(), 'evidence', 'tamper');
  const json = JSON.parse(exportProofGraph(graph));
  json.nodes[0].refId = 'changed';
  assert.throws(() => importProofGraph(JSON.stringify(json)), /graphId|mismatch|invalid/i);
});
