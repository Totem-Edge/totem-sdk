import {
  computeVtxoLeaf,
  computeVtxoId,
  computeCommitmentRoot,
  verifyMerkleProof,
  buildVtxoProofSet,
} from '../commitment';
import { OmniaVtxo } from '../types';
import { EMPTY_LEAF, MOCK_BATCH_ID } from '../constants';

function makeVtxo(overrides: Partial<OmniaVtxo> = {}): OmniaVtxo {
  return {
    vtxoId: 'vtxo-1',
    poolId: 'pool-1',
    owner: 'alice',
    amount: BigInt(1000),
    tokenId: 'token-0',
    status: 'active',
    epoch: 0,
    proof: { leaf: '', root: '', siblings: [], positions: [], epoch: 0, batchId: MOCK_BATCH_ID },
    history: [],
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

describe('computeVtxoLeaf', () => {
  it('returns a 64-char hex string', () => {
    const vtxo = makeVtxo();
    const leaf = computeVtxoLeaf(vtxo);
    expect(leaf).toHaveLength(64);
    expect(leaf).toMatch(/^[0-9a-f]+$/);
  });

  it('is deterministic', () => {
    const vtxo = makeVtxo();
    expect(computeVtxoLeaf(vtxo)).toBe(computeVtxoLeaf(vtxo));
  });

  it('differs for different amounts', () => {
    const a = makeVtxo({ amount: BigInt(100) });
    const b = makeVtxo({ amount: BigInt(200) });
    expect(computeVtxoLeaf(a)).not.toBe(computeVtxoLeaf(b));
  });

  it('differs for different owners', () => {
    const a = makeVtxo({ owner: 'alice' });
    const b = makeVtxo({ owner: 'bob' });
    expect(computeVtxoLeaf(a)).not.toBe(computeVtxoLeaf(b));
  });
});

describe('computeVtxoId', () => {
  it('returns a 64-char hex string', () => {
    const id = computeVtxoId({ poolId: 'p', owner: 'alice', amount: BigInt(100), tokenId: 't', nonce: 'n' });
    expect(id).toHaveLength(64);
  });

  it('is deterministic', () => {
    const params = { poolId: 'p', owner: 'alice', amount: BigInt(100), tokenId: 't', nonce: 'n' };
    expect(computeVtxoId(params)).toBe(computeVtxoId(params));
  });

  it('differs for different nonces', () => {
    const base = { poolId: 'p', owner: 'alice', amount: BigInt(100), tokenId: 't' };
    expect(computeVtxoId({ ...base, nonce: 'n1' })).not.toBe(computeVtxoId({ ...base, nonce: 'n2' }));
  });
});

describe('computeCommitmentRoot', () => {
  it('returns EMPTY_LEAF for empty input', () => {
    expect(computeCommitmentRoot([])).toBe(EMPTY_LEAF);
  });

  it('returns the leaf itself for one leaf', () => {
    const leaf = 'a'.repeat(64);
    const root = computeCommitmentRoot([leaf]);
    expect(root).toHaveLength(64);
  });

  it('returns a hash for two leaves', () => {
    const a = 'a'.repeat(64);
    const b = 'b'.repeat(64);
    const root = computeCommitmentRoot([a, b]);
    expect(root).toHaveLength(64);
    expect(root).not.toBe(a);
    expect(root).not.toBe(b);
  });

  it('is deterministic for multiple leaves', () => {
    const leaves = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)];
    expect(computeCommitmentRoot(leaves)).toBe(computeCommitmentRoot(leaves));
  });

  it('gives different roots for different leaf orderings', () => {
    const a = 'aa'.repeat(32);
    const b = 'bb'.repeat(32);
    const c = 'cc'.repeat(32);
    const root1 = computeCommitmentRoot([a, b, c]);
    const root2 = computeCommitmentRoot([c, a, b]);
    expect(root1).not.toBe(root2);
  });
});

describe('verifyMerkleProof', () => {
  it('verifies a single-element proof set', () => {
    const vtxo = makeVtxo();
    const { root, proofs } = buildVtxoProofSet([vtxo]);
    const proof = proofs[vtxo.vtxoId];
    const nodes = proof.siblings.map((s, i) => ({ sibling: s, position: proof.positions[i] }));
    expect(verifyMerkleProof(proof.leaf, nodes, root)).toBe(true);
  });

  it('verifies a two-element proof set', () => {
    const a = makeVtxo({ vtxoId: 'vtxo-a' });
    const b = makeVtxo({ vtxoId: 'vtxo-b', owner: 'bob' });
    const { root, proofs } = buildVtxoProofSet([a, b]);
    for (const id of ['vtxo-a', 'vtxo-b']) {
      const proof = proofs[id];
      const nodes = proof.siblings.map((s, i) => ({ sibling: s, position: proof.positions[i] }));
      expect(verifyMerkleProof(proof.leaf, nodes, root)).toBe(true);
    }
  });

  it('rejects tampered leaf', () => {
    const vtxo = makeVtxo();
    const { root, proofs } = buildVtxoProofSet([vtxo]);
    const proof = proofs[vtxo.vtxoId];
    const nodes = proof.siblings.map((s, i) => ({ sibling: s, position: proof.positions[i] }));
    expect(verifyMerkleProof('0'.repeat(64), nodes, root)).toBe(false);
  });
});

describe('buildVtxoProofSet', () => {
  it('returns empty proofs for empty vtxos', () => {
    const { root, proofs } = buildVtxoProofSet([]);
    expect(root).toBe(EMPTY_LEAF);
    expect(Object.keys(proofs)).toHaveLength(0);
  });

  it('builds proof for one vtxo', () => {
    const vtxo = makeVtxo();
    const { root, proofs } = buildVtxoProofSet([vtxo]);
    expect(root).toHaveLength(64);
    expect(proofs[vtxo.vtxoId]).toBeDefined();
    expect(proofs[vtxo.vtxoId].leaf).toHaveLength(64);
  });

  it('builds proofs for two vtxos and all are verifiable', () => {
    const a = makeVtxo({ vtxoId: 'vtxo-a' });
    const b = makeVtxo({ vtxoId: 'vtxo-b', owner: 'bob' });
    const { root, proofs } = buildVtxoProofSet([a, b]);
    for (const v of [a, b]) {
      const proof = proofs[v.vtxoId];
      const nodes = proof.siblings.map((s, i) => ({ sibling: s, position: proof.positions[i] }));
      expect(verifyMerkleProof(proof.leaf, nodes, root)).toBe(true);
    }
  });

  it('builds proofs for multiple vtxos and all are verifiable', () => {
    const vtxos = ['a', 'b', 'c', 'd', 'e'].map((id, i) =>
      makeVtxo({ vtxoId: `vtxo-${id}`, owner: `owner-${id}`, amount: BigInt(100 * (i + 1)) })
    );
    const { root, proofs } = buildVtxoProofSet(vtxos);
    for (const v of vtxos) {
      const proof = proofs[v.vtxoId];
      const nodes = proof.siblings.map((s, i) => ({ sibling: s, position: proof.positions[i] }));
      expect(verifyMerkleProof(proof.leaf, nodes, root)).toBe(true);
    }
  });

  it('handles BigInt amounts consistently', () => {
    const vtxo = makeVtxo({ amount: BigInt('999999999999999999') });
    const { proofs } = buildVtxoProofSet([vtxo]);
    expect(proofs[vtxo.vtxoId].leaf).toHaveLength(64);
    const vtxo2 = makeVtxo({ amount: BigInt('999999999999999999') });
    const { proofs: proofs2 } = buildVtxoProofSet([vtxo2]);
    expect(proofs[vtxo.vtxoId].leaf).toBe(proofs2[vtxo2.vtxoId].leaf);
  });
});
