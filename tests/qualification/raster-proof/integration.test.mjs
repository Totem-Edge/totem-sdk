import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../_shared/init-proof-wasm.mjs';
import {
  chunkBytes,
  computeMerkleRoot,
  merkleLeafHash,
  createMerkleProof,
  verifyMerkleProof,
  createRasterWindowProof,
  rasterWindowProofToEvidenceRef,
} from '../../../packages/raster-proof/dist/index.js';
import { createProof, signProof, verifyProof } from '../../../packages/proof/dist/index.js';
import { createProofGraph, addProof, getProofNodes } from '../../../packages/proofgraph/dist/index.js';

const SEED = new Uint8Array(32).fill(67);
const NOW = 1_700_000_000_000;
const BYTES = new TextEncoder().encode('raster-evidence-'.repeat(8));

test('raster chunks produce a verifiable Merkle proof and a window evidence ref', () => {
  const chunks = chunkBytes(BYTES, 16);
  assert.ok(chunks.length > 1);

  const root = computeMerkleRoot(chunks);
  const proof = createMerkleProof(chunks, 1);
  assert.equal(proof.root, root);
  assert.equal(verifyMerkleProof(proof), true);

  const tampered = { ...proof, leafHash: '00'.repeat(32) };
  assert.equal(verifyMerkleProof(tampered), false);

  const window = createRasterWindowProof({
    rasterId: 'raster-1',
    merkleRoot: root,
    chunkIndices: [1],
    chunkHashes: [merkleLeafHash(chunks[1])],
    createdAt: NOW,
  });
  const evidence = rasterWindowProofToEvidenceRef(window);
  assert.equal(evidence.kind, 'raster-window-proof');
  assert.match(evidence.hash, /^[0-9a-f]{64}$/);
});

test('raster evidence chains into a signed proof and the proof graph', () => {
  const chunks = chunkBytes(BYTES, 16);
  const window = createRasterWindowProof({
    rasterId: 'raster-2',
    merkleRoot: computeMerkleRoot(chunks),
    chunkIndices: [0],
    chunkHashes: [merkleLeafHash(chunks[0])],
    createdAt: NOW,
  });
  const evidence = rasterWindowProofToEvidenceRef(window);

  const signed = signProof(
    createProof({
      kind: 'attestation',
      subject: { id: 'mission:1', kind: 'mission' },
      issuer: 'device:drone-1',
      issuedAt: NOW,
      evidence: [evidence],
    }),
    SEED,
    0,
  );
  assert.equal(verifyProof(signed, { now: NOW + 1000 }).valid, true);

  const graph = addProof(createProofGraph(), signed);
  assert.equal(getProofNodes(graph).length, 1);
  assert.equal(graph.nodes.some((node) => node.type === 'evidence' && node.refId === evidence.id), true);
});
