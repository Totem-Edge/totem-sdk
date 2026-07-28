/**
 * @totemsdk/proofgraph — test suite (16 tests)
 *
 * Tests:
 *  1  createProofGraph returns empty graph with valid graphId
 *  2  addProof creates proof/issuer/subject/evidence/anchor nodes
 *  3  addProof is deterministic (same proof added twice → same graphId)
 *  4  proof links create graph edges
 *  5  anchors create anchored_to edges
 *  6  identity claim type → edge type mapping (delegates_to/revokes/rotates_to)
 *  7  manifest adds manifest+address nodes with manifests_as edge
 *  8  findProofsBySubject finds correct proof nodes (via about OR proves)
 *  9  getEvidenceTrail returns evidence in correct order
 * 10  getProofLineage traverses derived_from chain
 * 11  revocation removes proof from resolveCurrentProofSet
 * 12  supersession removes old proof from resolveCurrentProofSet
 * 13  verifyProofGraph delegates to @totemsdk/proof verifyProof (spy)
 * 14  invalid proof IDs appear in ProofGraphVerifyResult.invalidProofs
 * 15  exportProofGraph + importProofGraph round-trips graphId
 * 16  all root exports present
 */

import {
  createProofGraph,
  addProof,
  addIdentityClaim,
  addManifest,
  addIdentityDocument,
  addEdge,
  buildEdge,
  addReceiptLike,
  addAnchor,
  findNode,
  findProofsBySubject,
  findProofsByIssuer,
  findAnchorsForProof,
  findRevocations,
  findSupersessions,
  getEvidenceTrail,
  getProofLineage,
  resolveCurrentProofSet,
  verifyProofGraph,
  verifyGraphProofs,
  exportProofGraph,
  importProofGraph,
} from '../index';

import * as ProofGraphModule from '../index';
import * as proofModule from '@totemsdk/proof';

import {
  createProof,
  signProof,
} from '@totemsdk/proof';

import {
  createDelegationClaim,
  signIdentityClaim,
  revokeIdentity,
  rotateIdentity,
  createIdentityDocument,
} from '@totemsdk/identity';

import { signManifest } from '@totemsdk/manifest';

import { wotsKeypairFromSeed, wotsAddressFromKeypair } from '@totemsdk/core';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function testSeed(n: number): Uint8Array {
  const s = new Uint8Array(32);
  s[0] = n & 0xff;
  s[1] = (n >> 8) & 0xff;
  return s;
}

const SEED_A = testSeed(1);
const SEED_B = testSeed(2);

function deriveAddress(seed: Uint8Array, keyIndex: number): string {
  const kp = wotsKeypairFromSeed(seed, keyIndex);
  return wotsAddressFromKeypair(kp);
}

function makeSignedProof(opts?: {
  subjectId?: string;
  seed?: Uint8Array;
  keyIndex?: number;
  issuer?: string;
  evidence?: Array<{ id: string; kind: string; hash: string }>;
  anchor?: { provider: string; hash: string };
}) {
  const subjectId = opts?.subjectId ?? 'totem:subject:test:1';
  const seed = opts?.seed ?? SEED_A;
  const keyIndex = opts?.keyIndex ?? 0;
  const issuer = opts?.issuer ?? 'MxISSUER';
  const unsigned = createProof({
    kind: 'attestation',
    subject: { id: subjectId, kind: 'device' },
    issuer,
    issuedAt: 1000,
    ...(opts?.evidence ? { evidence: opts.evidence } : {}),
  });
  const signed = signProof(unsigned, seed, keyIndex);
  if (opts?.anchor) {
    return { ...signed, anchor: opts.anchor };
  }
  return signed;
}

// ─── Test 1: createProofGraph ─────────────────────────────────────────────────

test('(1) createProofGraph returns empty graph with valid graphId', () => {
  const g = createProofGraph();
  expect(g.graphId).toBeDefined();
  expect(typeof g.graphId).toBe('string');
  expect(g.graphId).toHaveLength(64);
  expect(g.nodes).toHaveLength(0);
  expect(g.edges).toHaveLength(0);

  const g2 = createProofGraph();
  expect(g.graphId).toBe(g2.graphId);
});

// ─── Test 2: addProof node types ──────────────────────────────────────────────

test('(2) addProof creates proof/issuer/subject/evidence/anchor nodes', () => {
  const sp = makeSignedProof({
    subjectId: 'totem:subject:test:2',
    evidence: [{ id: 'ev-1', kind: 'file', hash: 'deadbeef' }],
    anchor: { provider: 'minima', hash: 'sha256:aabbccdd' },
  });
  const graph = addProof(createProofGraph(), sp);

  const proofNode = findNode(graph, sp.proofId);
  const issuerNode = findNode(graph, sp.signature.address);
  const subjectNode = findNode(graph, sp.subject.id);
  const evidenceNode = findNode(graph, 'ev-1');
  const anchorNode = findNode(graph, sp.anchor!.hash);

  expect(proofNode?.type).toBe('proof');
  expect(issuerNode?.type).toBe('identity');
  expect(subjectNode?.type).toBe('subject');
  expect(evidenceNode?.type).toBe('evidence');
  expect(anchorNode?.type).toBe('anchor');

  const stored = proofNode!.data as Record<string, unknown>;
  expect(stored['proofId']).toBe(sp.proofId);
});

// ─── Test 3: addProof determinism ─────────────────────────────────────────────

test('(3) addProof is deterministic — same proof added twice → same graphId', () => {
  const sp = makeSignedProof();
  const g0 = createProofGraph();
  const g1 = addProof(g0, sp);
  const g2 = addProof(g1, sp);
  expect(g1.graphId).toBe(g2.graphId);
  expect(g2.nodes).toHaveLength(g1.nodes.length);

  // graphId is content-deterministic across time: two independently-built
  // graphs with identical logical content share the same graphId even though
  // their node.createdAt timestamps differ (createdAt is excluded from the hash).
  const gA = addProof(createProofGraph(), sp);
  const gB = addProof(createProofGraph(), sp);
  expect(gA.graphId).toBe(gB.graphId);
});

// ─── Test 4: proof links create graph edges ───────────────────────────────────

test('(4) proof links create graph edges', () => {
  const sp = makeSignedProof({ subjectId: 'totem:subject:test:4' });
  const graph = addProof(createProofGraph(), sp);

  const provesEdges = graph.edges.filter((e) => e.type === 'proves');
  const issuedByEdges = graph.edges.filter((e) => e.type === 'issued_by');
  const aboutEdges = graph.edges.filter((e) => e.type === 'about');

  expect(provesEdges).toHaveLength(1);
  expect(provesEdges[0].from).toBe(sp.proofId);
  expect(provesEdges[0].to).toBe(sp.subject.id);

  expect(issuedByEdges).toHaveLength(1);
  expect(issuedByEdges[0].from).toBe(sp.proofId);
  expect(issuedByEdges[0].to).toBe(sp.signature.address);

  expect(aboutEdges).toHaveLength(1);
  expect(aboutEdges[0].from).toBe(sp.proofId);
  expect(aboutEdges[0].to).toBe(sp.subject.id);
});

// ─── Test 5: anchors create anchored_to edges ─────────────────────────────────

test('(5) anchors create anchored_to edges', () => {
  const sp = makeSignedProof({
    anchor: { provider: 'minima', hash: 'sha256:anchor5' },
  });
  const graph = addProof(createProofGraph(), sp);

  const anchoredEdges = graph.edges.filter((e) => e.type === 'anchored_to');
  expect(anchoredEdges).toHaveLength(1);
  expect(anchoredEdges[0].from).toBe(sp.proofId);
  expect(anchoredEdges[0].to).toBe('sha256:anchor5');

  const anchors = findAnchorsForProof(graph, sp.proofId);
  expect(anchors).toHaveLength(1);
  expect(anchors[0].refId).toBe('sha256:anchor5');
});

// ─── Test 6: identity claim edge types ───────────────────────────────────────

describe('(6) identity claim type → edge type mapping', () => {
  const rootAddr = deriveAddress(SEED_A, 0);
  const identitySubject = 'totem:id:device:test6';

  it('delegates_to creates a delegates_to edge', async () => {
    const claim = createDelegationClaim({
      issuer: rootAddr,
      subject: identitySubject,
      delegatedAddress: 'MxDELEGATE',
      scopes: ['manifest:sign'],
      issuedAt: 1000,
    });
    const signed = await signIdentityClaim(claim, SEED_A, 0);
    const graph = addIdentityClaim(createProofGraph(), signed);
    const edges = graph.edges.filter((e) => e.type === 'delegates_to');
    expect(edges).toHaveLength(1);
    expect(edges[0].from).toBe(claim.id);
    expect(edges[0].to).toBe('MxDELEGATE');
  }, 30000);

  it('revokes creates a revokes edge', async () => {
    const claim = revokeIdentity({
      issuer: rootAddr,
      subject: identitySubject,
      reason: 'compromised',
      issuedAt: 2000,
    });
    const signed = await signIdentityClaim(claim, SEED_A, 0);
    const graph = addIdentityClaim(createProofGraph(), signed);
    const edges = graph.edges.filter((e) => e.type === 'revokes');
    expect(edges).toHaveLength(1);
    expect(edges[0].from).toBe(claim.id);
  }, 30000);

  it('rotates_to creates a controls edge', async () => {
    const claim = rotateIdentity({
      issuer: rootAddr,
      subject: identitySubject,
      newAddress: 'MxNEWROOT',
      issuedAt: 3000,
    });
    const signed = await signIdentityClaim(claim, SEED_A, 0);
    const graph = addIdentityClaim(createProofGraph(), signed);
    const edges = graph.edges.filter((e) => e.type === 'controls');
    expect(edges).toHaveLength(1);
    expect(edges[0].from).toBe(claim.id);
    expect(edges[0].to).toBe('MxNEWROOT');
  }, 30000);
});

// ─── Test 7: addManifest ──────────────────────────────────────────────────────

test('(7) manifest adds manifest+address nodes with manifests_as edge', async () => {
  const signerAddr = deriveAddress(SEED_A, 0);
  const raw = {
    type: 'edge-service' as const,
    serviceId: 'svc-pg-7',
    name: 'Test PG Service',
    version: '1.0.0',
    operatorAddress: signerAddr,
    serviceType: 'sensor' as const,
    description: 'test',
    capabilities: [],
    tags: [],
  };
  const signed = await signManifest(raw, SEED_A, 0);
  const graph = addManifest(createProofGraph(), signed);

  const manifestNodes = graph.nodes.filter((n) => n.type === 'manifest');
  const addressNodes = graph.nodes.filter((n) => n.type === 'address');
  const edges = graph.edges.filter((e) => e.type === 'manifests_as');

  expect(manifestNodes).toHaveLength(1);
  expect(addressNodes).toHaveLength(1);
  expect(edges).toHaveLength(1);
  expect(edges[0].to).toBe(signerAddr);
}, 30000);

// ─── Test 8: findProofsBySubject ──────────────────────────────────────────────

test('(8) findProofsBySubject finds correct proof nodes (via about OR proves)', () => {
  const sp1 = makeSignedProof({ subjectId: 'totem:subject:S1', seed: SEED_A, keyIndex: 0 });
  const sp2 = makeSignedProof({ subjectId: 'totem:subject:S2', seed: SEED_B, keyIndex: 0 });
  const graph = addProof(addProof(createProofGraph(), sp1), sp2);

  const forS1 = findProofsBySubject(graph, 'totem:subject:S1');
  expect(forS1).toHaveLength(1);
  expect(forS1[0].refId).toBe(sp1.proofId);

  const forS2 = findProofsBySubject(graph, 'totem:subject:S2');
  expect(forS2).toHaveLength(1);
  expect(forS2[0].refId).toBe(sp2.proofId);

  expect(findProofsBySubject(graph, 'totem:subject:NONE')).toHaveLength(0);
});

// ─── Test 9: getEvidenceTrail ─────────────────────────────────────────────────

test('(9) getEvidenceTrail returns evidence nodes in insertion order', () => {
  const sp = makeSignedProof({
    subjectId: 'totem:subject:EV9',
    evidence: [
      { id: 'ev-A', kind: 'file', hash: 'aaaa' },
      { id: 'ev-B', kind: 'hash', hash: 'bbbb' },
      { id: 'ev-C', kind: 'log', hash: 'cccc' },
    ],
  });
  const graph = addProof(createProofGraph(), sp);
  const trail = getEvidenceTrail(graph, sp.proofId);
  expect(trail).toHaveLength(3);
  expect(trail[0].refId).toBe('ev-A');
  expect(trail[1].refId).toBe('ev-B');
  expect(trail[2].refId).toBe('ev-C');
});

// ─── Test 10: getProofLineage ─────────────────────────────────────────────────

test('(10) getProofLineage traverses derived_from chain', () => {
  const sp1 = makeSignedProof({ subjectId: 'totem:subject:L1', seed: SEED_A, keyIndex: 0 });
  const sp2 = makeSignedProof({ subjectId: 'totem:subject:L2', seed: SEED_A, keyIndex: 0 });
  const sp3 = makeSignedProof({ subjectId: 'totem:subject:L3', seed: SEED_A, keyIndex: 0 });

  let graph = createProofGraph();
  graph = addProof(graph, sp1);
  graph = addProof(graph, sp2);
  graph = addProof(graph, sp3);
  graph = addEdge(graph, buildEdge('derived_from', sp1.proofId, sp2.proofId, sp1.proofId));
  graph = addEdge(graph, buildEdge('derived_from', sp2.proofId, sp3.proofId, sp2.proofId));

  const lineage = getProofLineage(graph, sp1.proofId);
  expect(lineage).toHaveLength(2);
  expect(lineage[0].refId).toBe(sp2.proofId);
  expect(lineage[1].refId).toBe(sp3.proofId);
});

// ─── Test 11: revocation removes proof from resolveCurrentProofSet ────────────

test('(11) revocation removes proof from resolveCurrentProofSet', () => {
  const sp1 = makeSignedProof({ subjectId: 'totem:subject:R1a', seed: SEED_A, keyIndex: 0 });
  const sp2 = makeSignedProof({ subjectId: 'totem:subject:R1b', seed: SEED_A, keyIndex: 0 });

  let graph = createProofGraph();
  graph = addProof(graph, sp1);
  graph = addProof(graph, sp2);

  const beforeRevoke = resolveCurrentProofSet(graph);
  expect(beforeRevoke).toHaveLength(2);

  graph = addEdge(graph, buildEdge('revokes', sp2.proofId, sp1.proofId));

  const afterRevoke = resolveCurrentProofSet(graph);
  expect(afterRevoke).toHaveLength(1);
  expect(afterRevoke[0].refId).toBe(sp2.proofId);
  expect(findRevocations(graph, sp1.proofId)).toHaveLength(1);
});

// ─── Test 12: supersession removes old proof from resolveCurrentProofSet ──────

test('(12) supersession removes old proof from resolveCurrentProofSet', () => {
  const sp1 = makeSignedProof({ subjectId: 'totem:subject:SS1a', seed: SEED_A, keyIndex: 0 });
  const sp2 = makeSignedProof({ subjectId: 'totem:subject:SS1b', seed: SEED_A, keyIndex: 0 });

  let graph = createProofGraph();
  graph = addProof(graph, sp1);
  graph = addProof(graph, sp2);

  const before = resolveCurrentProofSet(graph);
  expect(before).toHaveLength(2);

  graph = addEdge(graph, buildEdge('supersedes', sp2.proofId, sp1.proofId));

  const after = resolveCurrentProofSet(graph);
  expect(after).toHaveLength(1);
  expect(after[0].refId).toBe(sp2.proofId);
  expect(findSupersessions(graph, sp1.proofId)).toHaveLength(1);
});

// ─── Test 13: verifyProofGraph delegates to verifyProof (spy) ─────────────────

test('(13) verifyProofGraph delegates each proof node to @totemsdk/proof verifyProof', () => {
  const sp = makeSignedProof();
  const graph = addProof(createProofGraph(), sp);

  const spy = jest.spyOn(proofModule, 'verifyProof');
  verifyProofGraph(graph);
  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy).toHaveBeenCalledWith(expect.objectContaining({ proofId: sp.proofId }));
  spy.mockRestore();
});

// ─── Test 14: invalid proof IDs in invalidProofs ──────────────────────────────

test('(14) invalid proof IDs appear in ProofGraphVerifyResult.invalidProofs', () => {
  const sp = makeSignedProof();
  const tampered = {
    ...sp,
    signature: { ...sp.signature, signature: '00'.repeat(134) },
  };
  const graph = addProof(createProofGraph(), tampered);

  const result = verifyProofGraph(graph);
  expect(result.valid).toBe(false);
  expect(result.invalidProofs).toContain(sp.proofId);

  const ids = verifyGraphProofs(graph);
  expect(Array.isArray(ids)).toBe(true);
  expect(ids).toContain(sp.proofId);
});

// ─── Test 15: exportProofGraph + importProofGraph round-trip ──────────────────

test('(15) exportProofGraph + importProofGraph round-trips graphId', () => {
  const sp = makeSignedProof();
  const g1 = addProof(createProofGraph(), sp);
  const json = exportProofGraph(g1);
  const g2 = importProofGraph(json);
  expect(g2.graphId).toBe(g1.graphId);
  expect(g2.nodes).toHaveLength(g1.nodes.length);
  expect(g2.edges).toHaveLength(g1.edges.length);

  expect(() => importProofGraph(JSON.stringify({ ...g1, graphId: 'tampered' }))).toThrow(
    /graphId mismatch/,
  );
});

// ─── Test 16: all root exports present ───────────────────────────────────────

test('(16) all required root exports are present', () => {
  const required = [
    'createProofGraph',
    'setGraphMetadata',
    'buildEdge',
    'addNode',
    'addEdge',
    'addIdentityDocument',
    'addProof',
    'addIdentityClaim',
    'addManifest',
    'addReceiptLike',
    'addAnchor',
    'findNode',
    'getEdgesFrom',
    'getEdgesTo',
    'getEdgesByType',
    'getProofNodes',
    'findProofsBySubject',
    'findProofsByIssuer',
    'findAnchorsForProof',
    'findRevocations',
    'findSupersessions',
    'findConflicts',
    'getEvidenceTrail',
    'getProofLineage',
    'resolveCurrentProofSet',
    'getManifestsForAddress',
    'getEdgesBetween',
    'reachableFrom',
    'verifyProofGraph',
    'verifyGraphProofs',
    'exportProofGraph',
    'importProofGraph',
    'toHex',
    'canonicalJson',
    'computeNodeId',
    'computeEdgeId',
    'computeProofGraphId',
    'recomputeGraphId',
  ] as const;

  for (const name of required) {
    expect(typeof (ProofGraphModule as Record<string, unknown>)[name]).toBe('function');
  }
});
