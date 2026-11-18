/**
 * OMN-010 — authoritative verification must require a membership proof and
 * anchor its root to a published pool root.
 */

import { createPool } from '../pool';
import { mintVtxo } from '../vtxo';
import { verifyVtxo, verifyVtxoMembership } from '../verify';
import { computeVtxoId, computeVtxoLeaf } from '../commitment';
import type { OmniaVtxo } from '../types';

const NOW = 1_000;

function setup(nonce = 'n1') {
  const pool = createPool(
    { operator: 'op-1', tokenId: '0x00', totalCapacity: 1_000_000n, nonce },
    NOW,
  );
  const minted = mintVtxo(pool, { owner: 'alice', amount: 500n, nonce: `mint-${nonce}` }, NOW);
  return { pool: minted.pool, vtxo: minted.vtxo };
}

describe('OMN-010 — verifyVtxo anchoring', () => {
  it('fails authoritative verification when no expected root is supplied', () => {
    const { vtxo } = setup();
    const result = verifyVtxo(vtxo);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => /anchored root/i.test(error))).toBe(true);
  });

  it('fails authoritative verification for a VTXO without a proof', () => {
    const { vtxo, pool } = setup();
    const noProof: OmniaVtxo = {
      ...vtxo,
      proof: { leaf: '', root: '', siblings: [], positions: [], epoch: vtxo.epoch, batchId: '' },
    };
    const result = verifyVtxo(noProof, { expectedRoot: pool.commitmentRoot });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => /Missing membership proof/i.test(error))).toBe(true);
    expect(verifyVtxoMembership(noProof, pool).valid).toBe(false);
  });

  it('rejects a proof against a different root', () => {
    const { vtxo } = setup('n2');
    const other = 'f'.repeat(64);
    const wrongRoot: OmniaVtxo = { ...vtxo, proof: { ...vtxo.proof, root: other } };

    expect(verifyVtxo(wrongRoot, { expectedRoot: other }).valid).toBe(false);
    expect(verifyVtxo(vtxo, { expectedRoot: other }).valid).toBe(false);
  });

  it('rejects a self-consistent proof whose root the pool never published', () => {
    const { vtxo } = setup('n3');
    // A different pool produces a different leaf (the leaf binds poolId).
    const { vtxo: foreign } = setup('n4');
    expect(foreign.proof.root).not.toBe(vtxo.proof.root);
    expect(verifyVtxo(foreign, { expectedRoot: vtxo.proof.root }).valid).toBe(false);
  });

  it('accepts a valid proof against the anchored root', () => {
    const { vtxo, pool } = setup('n5');
    expect(verifyVtxo(vtxo, { expectedRoot: pool.commitmentRoot }).valid).toBe(true);
    expect(verifyVtxo(vtxo, { expectedRoot: vtxo.proof.root }).valid).toBe(true);
  });

  it('requires an explicit opt-out for unanchored structural checks', () => {
    const { vtxo } = setup('n6');
    const noProof: OmniaVtxo = {
      ...vtxo,
      proof: { leaf: '', root: '', siblings: [], positions: [], epoch: vtxo.epoch, batchId: '' },
    };
    expect(verifyVtxo(noProof).valid).toBe(false);
    const structural = verifyVtxo(noProof, { allowUnanchored: true });
    expect(structural.valid).toBe(true);
    // A present-but-tampered proof is still rejected even with the opt-out.
    const tampered: OmniaVtxo = { ...vtxo, proof: { ...vtxo.proof, leaf: '0'.repeat(64) } };
    expect(verifyVtxo(tampered, { allowUnanchored: true }).valid).toBe(false);
  });
});

describe('OMN-010 — verifyVtxoMembership', () => {
  it('anchors a VTXO to the pool it belongs to', () => {
    const { vtxo, pool } = setup('n7');
    expect(verifyVtxoMembership(vtxo, pool).valid).toBe(true);
  });

  it('rejects a VTXO from a different pool', () => {
    const { vtxo } = setup('n8');
    const { pool: otherPool } = setup('n9');
    const result = verifyVtxoMembership(vtxo, otherPool);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => /Pool mismatch/.test(error))).toBe(true);
  });

  it('rejects a VTXO that is not in the pool membership set', () => {
    const { vtxo, pool } = setup('n10');
    const impostor: OmniaVtxo = {
      ...vtxo,
      vtxoId: computeVtxoId({
        poolId: pool.poolId,
        owner: 'alice',
        amount: 500n,
        tokenId: pool.tokenId,
        nonce: 'impostor',
      }),
    };
    const result = verifyVtxoMembership(impostor, pool);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => /not a member/.test(error))).toBe(true);
  });

  it('rejects a member whose leaf no longer matches its fields', () => {
    const { vtxo, pool } = setup('n11');
    const tampered: OmniaVtxo = { ...vtxo, owner: 'mallory' };
    // Recompute the leaf so the Merkle proof path itself is inconsistent with
    // the committed member record.
    expect(computeVtxoLeaf(tampered)).not.toBe(computeVtxoLeaf(vtxo));
    expect(verifyVtxoMembership(tampered, pool).valid).toBe(false);
  });

  it('rejects a proof whose root is not a published pool root', () => {
    const { vtxo, pool } = setup('n12');
    const rewritten: OmniaVtxo = { ...vtxo, proof: { ...vtxo.proof, root: 'a'.repeat(64) } };
    const result = verifyVtxoMembership(rewritten, pool);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => /not a published pool root/.test(error))).toBe(true);
  });
});
