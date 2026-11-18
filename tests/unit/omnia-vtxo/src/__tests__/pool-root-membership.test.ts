/**
 * OMN-002 — the pool commitment root must cover the pool membership set.
 *
 * A second mint used to replace `pool.commitmentRoot` with a single-leaf root
 * and invalidate the first VTXO. These tests mint sequentially and require all
 * proofs to stay verifiable against the pool's published roots.
 */

import { createPool, commitPoolMembers, poolPublishedRoots } from '../pool';
import { mintVtxo } from '../vtxo';
import { verifyVtxo, verifyVtxoMembership } from '../verify';
import { computeVtxoLeaf, buildVtxoProofSetFromMembers, computeVtxoId } from '../commitment';

const NOW = 1_000;

function newPool(nonce = 'n1') {
  return createPool(
    { operator: 'op-1', tokenId: 'token-0', totalCapacity: 1_000_000n, nonce },
    NOW,
  );
}

describe('OMN-002 — pool root membership', () => {
  it('keeps the first VTXO valid after a second mint', () => {
    const pool = newPool();
    const first = mintVtxo(pool, { owner: 'alice', amount: 500n, nonce: 'mint-1' }, NOW);
    const second = mintVtxo(first.pool, { owner: 'bob', amount: 500n, nonce: 'mint-2' }, NOW);

    expect(second.pool.commitmentRoot).not.toBe(first.pool.commitmentRoot);
    expect(second.pool.members).toHaveLength(2);
    expect(second.pool.epoch).toBe(2);
    expect(second.pool.epochRoots.map((entry) => entry.epoch)).toEqual([1, 2]);

    // Both proofs verify against roots the pool publishes.
    expect(poolPublishedRoots(second.pool)).toEqual(
      expect.arrayContaining([first.vtxo.proof.root, second.vtxo.proof.root]),
    );
    expect(verifyVtxoMembership(first.vtxo, second.pool).valid).toBe(true);
    expect(verifyVtxoMembership(second.vtxo, second.pool).valid).toBe(true);
  });

  it('no longer publishes the root of the second VTXO alone', () => {
    const pool = newPool('n-alone');
    const first = mintVtxo(pool, { owner: 'alice', amount: 500n, nonce: 'mint-1' }, NOW);
    const second = mintVtxo(first.pool, { owner: 'bob', amount: 500n, nonce: 'mint-2' }, NOW);

    // The old behaviour set commitmentRoot to the single-leaf root of B.
    expect(second.pool.commitmentRoot).not.toBe(computeVtxoLeaf(second.vtxo));
    expect(second.pool.commitmentRoot).toBe(
      buildVtxoProofSetFromMembers(second.pool.members).root,
    );
  });

  it('mints N VTXOs and verifies all N against the pool', () => {
    let pool = newPool('n-many');
    const minted = [];
    for (let i = 0; i < 7; i++) {
      const result = mintVtxo(
        pool,
        { owner: `owner-${i}`, amount: BigInt(100 + i), nonce: `mint-${i}` },
        NOW + i,
      );
      pool = result.pool;
      minted.push(result.vtxo);
    }

    expect(pool.members).toHaveLength(7);
    expect(pool.epoch).toBe(7);
    expect(pool.epochRoots).toHaveLength(7);

    for (const vtxo of minted) {
      expect(verifyVtxoMembership(vtxo, pool).valid).toBe(true);
    }

    // Re-anchoring the whole set produces proofs valid against the current root.
    const reanchored = buildVtxoProofSetFromMembers(pool.members);
    expect(reanchored.root).toBe(pool.commitmentRoot);
    for (const vtxo of minted) {
      expect(
        verifyVtxo({ ...vtxo, proof: reanchored.proofs[vtxo.vtxoId] }, {
          expectedRoot: pool.commitmentRoot,
        }).valid,
      ).toBe(true);
    }
  });

  it('never changes an existing VTXO id or leaf', () => {
    const pool = newPool('n-leaf');
    const first = mintVtxo(pool, { owner: 'alice', amount: 500n, nonce: 'mint-1' }, NOW);
    const second = mintVtxo(first.pool, { owner: 'bob', amount: 500n, nonce: 'mint-2' }, NOW);

    const member = second.pool.members.find((entry) => entry.vtxoId === first.vtxo.vtxoId);
    expect(member?.leaf).toBe(computeVtxoLeaf(first.vtxo));
    expect(member?.leaf).toBe(first.vtxo.proof.leaf);
    expect(member?.epoch).toBe(first.vtxo.epoch);
  });

  it('anchors a proof strictly to the current root when asked', () => {
    const pool = newPool('n-anchor');
    const first = mintVtxo(pool, { owner: 'alice', amount: 500n, nonce: 'mint-1' }, NOW);
    const second = mintVtxo(first.pool, { owner: 'bob', amount: 500n, nonce: 'mint-2' }, NOW);

    // A's proof is an epoch-1 proof; it must not pass as the current root.
    expect(verifyVtxo(first.vtxo, { expectedRoot: second.pool.commitmentRoot }).valid).toBe(false);
    expect(verifyVtxo(first.vtxo, { expectedRoot: first.vtxo.proof.root }).valid).toBe(true);
    expect(verifyVtxo(second.vtxo, { expectedRoot: second.pool.commitmentRoot }).valid).toBe(true);
  });

  it('appends operator-committed outputs without dropping earlier members', () => {
    const pool = newPool('n-append');
    const first = mintVtxo(pool, { owner: 'alice', amount: 500n, nonce: 'mint-1' }, NOW);
    const bob = mintVtxo(first.pool, { owner: 'bob', amount: 500n, nonce: 'mint-2' }, NOW);
    const carol = mintVtxo(bob.pool, { owner: 'carol', amount: 500n, nonce: 'mint-3' }, NOW);

    // Commit an additional output (e.g. a transfer/refresh result) in a new epoch.
    const nextEpoch = carol.pool.epoch + 1;
    const refreshedId = computeVtxoId({
      poolId: carol.pool.poolId,
      owner: 'carol',
      amount: 500n,
      tokenId: carol.pool.tokenId,
      nonce: 'refreshed-carol',
    });
    const refreshedCarol = {
      ...carol.vtxo,
      vtxoId: refreshedId,
      epoch: nextEpoch,
      proof: { ...carol.vtxo.proof, epoch: nextEpoch },
    };
    const committed = commitPoolMembers(carol.pool, [refreshedCarol]);
    expect(committed.pool.members).toHaveLength(4);
    expect(committed.pool.epoch).toBe(nextEpoch);
    expect(verifyVtxoMembership(first.vtxo, committed.pool).valid).toBe(true);
    expect(verifyVtxoMembership(bob.vtxo, committed.pool).valid).toBe(true);
    expect(verifyVtxoMembership({
      ...refreshedCarol,
      proof: committed.proofs[refreshedId],
    }, committed.pool).valid).toBe(true);
  });

  it('rejects a conflicting leaf for an already committed member', () => {
    const pool = newPool('n-conflict');
    const first = mintVtxo(pool, { owner: 'alice', amount: 500n, nonce: 'mint-1' }, NOW);
    const second = mintVtxo(first.pool, { owner: 'bob', amount: 500n, nonce: 'mint-2' }, NOW);
    const forged = { ...first.vtxo, owner: 'mallory', epoch: second.pool.epoch + 1, proof: { ...first.vtxo.proof, epoch: second.pool.epoch + 1 } };
    expect(() => commitPoolMembers(second.pool, [forged])).toThrow(/different leaf/);
  });
});
