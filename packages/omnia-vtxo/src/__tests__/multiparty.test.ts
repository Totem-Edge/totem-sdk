/**
 * Multiparty VTXO suite — Tier 1.
 *
 * Starts the plan in docs/VTXO_HARDENING_AND_MULTIPARTY_TEST_PLAN.md:
 * one operator pool, six independent owners, fan-out/split/change and chained
 * ownership, with independent proof verification and per-share exit drafts.
 */

import { createPool } from '../pool';
import { mintVtxo } from '../vtxo';
import { splitVtxo } from '../split';
import { transferVtxo } from '../transfer';
import { createExitDraft } from '../exit';
import { verifyVtxo, verifyVtxoProof, verifyVtxoTransfer } from '../verify';
import type { OmniaVtxo } from '../types';

const NOW = 1_000_000;
const OWNERS = ['owner-1', 'owner-2', 'owner-3', 'owner-4', 'owner-5', 'owner-6'];

function newPool(nonce: string, capacity = 1_000_000n) {
  return createPool(
    { operator: 'operator-1', tokenId: '0x00', totalCapacity: capacity, nonce },
    NOW,
  );
}

function assertClaimable(vtxo: OmniaVtxo, owner: string) {
  expect(vtxo.owner).toBe(owner);
  expect(verifyVtxo(vtxo).valid).toBe(true);
  expect(verifyVtxoProof(vtxo, vtxo.proof).valid).toBe(true);
  const exit = createExitDraft(vtxo, NOW + 10);
  expect(exit.draft.draftType).toBe('vtxo-exit');
  expect(exit.draft.owner).toBe(owner);
  expect(exit.draft.amount).toBe(vtxo.amount);
}

describe('multiparty VTXO — M1 six-owner fan-out', () => {
  it('splits one pool claim into six owner-bound claims and each owner can exit its share', () => {
    const pool = newPool('m1');
    const { vtxo: funding } = mintVtxo(pool, { owner: 'operator-1', amount: 60_000n, nonce: 'm1-mint' }, NOW);
    const { outputs } = splitVtxo(
      funding,
      { amounts: OWNERS.map(() => 10_000n), nonces: OWNERS.map((owner) => `m1-split-${owner}`) },
      NOW + 1,
    );
    expect(outputs).toHaveLength(6);

    const claims = outputs.map((output, index) => {
      const { output: claim, transfer } = transferVtxo(
        output,
        { recipient: OWNERS[index], amount: 10_000n, nonce: `m1-transfer-${OWNERS[index]}` },
        NOW + 2,
      );
      expect(verifyVtxoTransfer(output, claim, transfer).valid).toBe(true);
      return claim;
    });

    expect(claims.reduce((sum, claim) => sum + claim.amount, 0n)).toBe(60_000n);
    claims.forEach((claim, index) => assertClaimable(claim, OWNERS[index]));
    expect(new Set(claims.map((claim) => claim.vtxoId)).size).toBe(6);
  });
});

describe('multiparty VTXO — M2 split + change conservation', () => {
  it('preserves total value across six recipient shares plus change', () => {
    const pool = newPool('m2');
    const { vtxo } = mintVtxo(pool, { owner: 'operator-1', amount: 100_000n, nonce: 'm2-mint' }, NOW);
    const shares = [11_000n, 12_000n, 13_000n, 14_000n, 15_000n, 16_000n];
    const { outputs } = splitVtxo(
      vtxo,
      { amounts: [...shares, 19_000n], nonces: [...OWNERS, 'change'].map((n) => `m2-${n}`) },
      NOW + 1,
    );

    expect(outputs.reduce((sum, output) => sum + output.amount, 0n)).toBe(100_000n);
    expect(outputs[6].owner).toBe('operator-1');
    outputs.forEach((output) => {
      expect(verifyVtxo(output).valid).toBe(true);
      expect(verifyVtxoProof(output, output.proof).valid).toBe(true);
    });
  });
});

describe('multiparty VTXO — M3 chained ownership', () => {
  it('allows A→B→C and lets only the final owner produce an exit draft', () => {
    const pool = newPool('m3');
    const { vtxo: alice } = mintVtxo(pool, { owner: 'alice', amount: 25_000n, nonce: 'm3-mint' }, NOW);
    const aToB = transferVtxo(alice, { recipient: 'bob', amount: 25_000n, nonce: 'm3-ab' }, NOW + 1);
    const bToC = transferVtxo(aToB.output, { recipient: 'carol', amount: 25_000n, nonce: 'm3-bc' }, NOW + 2);

    expect(verifyVtxoTransfer(alice, aToB.output, aToB.transfer).valid).toBe(true);
    expect(verifyVtxoTransfer(aToB.output, bToC.output, bToC.transfer).valid).toBe(true);
    assertClaimable(bToC.output, 'carol');
    expect(bToC.output.owner).not.toBe('alice');
    expect(bToC.output.owner).not.toBe('bob');
  });
});

describe('multiparty VTXO — proof isolation', () => {
  it('rejects a tampered share proof before it can be claimed', () => {
    const pool = newPool('m4');
    const { vtxo } = mintVtxo(pool, { owner: 'owner-1', amount: 5_000n, nonce: 'm4-mint' }, NOW);
    const tampered = { ...vtxo, proof: { ...vtxo.proof, leaf: '0'.repeat(64) } };
    expect(verifyVtxoProof(tampered, tampered.proof).valid).toBe(false);
    expect(() => createExitDraft(tampered, NOW + 1)).toThrow();
  });
});
