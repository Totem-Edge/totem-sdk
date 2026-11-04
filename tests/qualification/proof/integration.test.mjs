import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../_shared/init-proof-wasm.mjs';
import { readFileSync } from 'node:fs';
import { init } from '../../../packages/core/dist/index.js';
import { createProof, signProof, verifyProofSignature } from '../../../packages/proof/dist/index.js';
import {
  createProofGraph,
  addProof,
  findProofsBySubject,
  exportProofGraph,
  importProofGraph,
  getProofNodes,
  verifyProofGraph,
} from '../../../packages/proofgraph/dist/index.js';

const coreGlue = new URL('../../../packages/core-wasm/pkg-web/totemsdk_core_wasm.js', import.meta.url);
await init({ module_or_path: readFileSync(new URL('./totemsdk_core_wasm_bg.wasm', coreGlue)) });

const SEED = new Uint8Array(32).fill(23);
const ISSUED_AT = 1_700_000_000_000;

function signedProof(device, index) {
  return signProof(
    createProof({
      kind: 'attestation',
      subject: { id: `device:${device}`, kind: 'device' },
      issuer: 'gateway:1',
      issuedAt: ISSUED_AT + index,
      evidence: [{ id: `ev-${index}`, kind: 'measurement', hash: String(index + 1).padStart(2, '0').repeat(32) }],
      links: index > 0 ? [{ proofId: `device:${device}:prev`, kind: 'supersedes' }] : undefined,
    }),
    SEED,
    index,
  );
}

test('signed proofs index into a proof graph and survive an export/import round-trip', () => {
  let graph = createProofGraph({ label: 'proof-integration' });
  const first = signedProof('1', 0);
  const second = signedProof('2', 1);
  graph = addProof(graph, first);
  graph = addProof(graph, second);

  const nodes = getProofNodes(graph);
  assert.equal(nodes.length, 2);
  assert.equal(findProofsBySubject(graph, 'device:1').length, 1);

  const roundTripped = importProofGraph(exportProofGraph(graph));
  assert.equal(roundTripped.graphId, graph.graphId);
  assert.equal(getProofNodes(roundTripped).length, 2);

  const verification = verifyProofGraph(roundTripped);
  assert.equal(verification.valid, true, verification.reason);

  for (const node of getProofNodes(roundTripped)) {
    const signed = node.data;
    assert.equal(verifyProofSignature(signed), true);
  }
});

test('adding the same proof twice is idempotent', () => {
  const signed = signedProof('3', 2);
  const once = addProof(createProofGraph(), signed);
  const twice = addProof(once, signed);
  assert.equal(twice.graphId, once.graphId);
  assert.equal(getProofNodes(twice).length, 1);
});
