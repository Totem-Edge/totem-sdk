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
import { transferVtxo, transferVtxoWithExit } from '../transfer';
import { createExitDraft } from '../exit';
import { mergeVtxos } from '../merge';
import { MemoryOmniaVtxoStore } from '../memory-store';
import { signVtxoReceipt, verifyVtxoReceipt } from '../receipt';
import { verifyClaimPolicy, type VtxoClaimPolicy } from '../claim-policy';
import { distributeYield } from '../yield';
import { buildExitTransaction } from '../exit-tx';
import { createVtxoExitEntitlement, verifyVtxoExitEntitlement } from '../exit-entitlement';
import { HTLCHelper } from '@totemsdk/core';
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


describe('multiparty VTXO — M4 concurrent claim at the store boundary', () => {
  it('allows only one claimant after the shared store marks the VTXO spent', async () => {
    const pool = newPool('m4');
    const { vtxo } = mintVtxo(pool, { owner: 'alice', amount: 5_000n, nonce: 'm4-mint' }, NOW);
    const store = new MemoryOmniaVtxoStore();
    await store.saveVtxo(vtxo);
    await store.markVtxoSpent(vtxo.vtxoId, NOW + 1);
    await expect(store.markVtxoSpent(vtxo.vtxoId, NOW + 2)).rejects.toThrow();
    expect(() => transferVtxo({ ...vtxo, status: 'spent' }, {
      recipient: 'bob', amount: 5_000n, nonce: 'm4-b',
    }, NOW + 3)).toThrow();
  });
});

describe('multiparty VTXO — M5 operator-offline exits', () => {
  it('lets six owners produce exit drafts without any operator call', () => {
    const pool = newPool('m5');
    const { vtxo } = mintVtxo(pool, { owner: 'operator-1', amount: 60_000n, nonce: 'm5-mint' }, NOW);
    const { outputs } = splitVtxo(vtxo, {
      amounts: OWNERS.map(() => 10_000n), nonces: OWNERS.map((o) => `m5-${o}`),
    }, NOW + 1);
    const claims = outputs.map((output, i) => transferVtxo(output, {
      recipient: OWNERS[i], amount: 10_000n, nonce: `m5-x-${OWNERS[i]}`,
    }, NOW + 2).output);
    const exits = claims.map((claim) => createExitDraft(claim, NOW + 3));
    expect(exits).toHaveLength(6);
    exits.forEach((exit, i) => {
      expect(exit.draft.owner).toBe(OWNERS[i]);
      expect(exit.draft.amount).toBe(10_000n);
    });
  });
});

describe('multiparty VTXO — M6 stale root/epoch rejection', () => {
  it('rejects a receipt committed to an old root and verifies false against the new root', async () => {
    const pool = newPool('m6');
    const { vtxo, receipt } = mintVtxo(pool, { owner: 'alice', amount: 1_000n, nonce: 'm6-mint' }, NOW);
    const operator = {
      poolId: pool.poolId,
      sign: async (data: Uint8Array) => 'sig:' + Buffer.from(data).toString('hex'),
      verify: async (data: Uint8Array, sig: string) => sig === 'sig:' + Buffer.from(data).toString('hex'),
    };
    const batch = { outputs: [vtxo], root: vtxo.proof.root, epoch: receipt.epoch };
    const signed = await signVtxoReceipt(operator, receipt, batch);
    expect(await verifyVtxoReceipt(operator, signed, '0'.repeat(64))).toBe(false);
    expect(() => buildVtxoReceiptPayload(receipt, { ...batch, root: '0'.repeat(64) })).toThrow();
  });
});

describe('multiparty VTXO — M7 merge rules', () => {
  it('merges same-owner shares and refuses a cross-owner merge', () => {
    const pool = newPool('m7');
    const { vtxo } = mintVtxo(pool, { owner: 'alice', amount: 10_000n, nonce: 'm7-mint' }, NOW);
    const { outputs } = splitVtxo(vtxo, { amounts: [4_000n, 6_000n], nonces: ['m7-a', 'm7-b'] }, NOW + 1);
    const merged = mergeVtxos(outputs, { owner: 'alice', nonce: 'm7-merge' }, NOW + 2);
    expect(merged.output.amount).toBe(10_000n);
    expect(merged.output.owner).toBe('alice');

    const bob = transferVtxo(outputs[0], { recipient: 'bob', amount: 4_000n, nonce: 'm7-bob' }, NOW + 3).output;
    expect(() => mergeVtxos([bob, outputs[1]], { owner: 'bob', nonce: 'm7-bad' }, NOW + 4)).toThrow();
  });
});


describe('multiparty VTXO — M8 threshold co-owned claim', () => {
  it('requires 2-of-3 owners and rejects a single or outsider signer', () => {
    const policy: VtxoClaimPolicy = { type: 'threshold', threshold: 2, owners: ['alice', 'bob', 'carol'] };
    expect(verifyClaimPolicy(policy, { signers: ['alice', 'bob'] }, { block: 1 }).valid).toBe(true);
    expect(verifyClaimPolicy(policy, { signers: ['alice'] }, { block: 1 }).valid).toBe(false);
    expect(verifyClaimPolicy(policy, { signers: ['alice', 'mallory'] }, { block: 1 }).valid).toBe(false);
    expect(verifyClaimPolicy({ ...policy, threshold: 4 }, { signers: ['alice', 'bob', 'carol'] }, { block: 1 }).valid).toBe(false);
  });
});

describe('multiparty VTXO — M9 conditional escrow claim', () => {
  it('allows preimage claim before timeout and refund after timeout only', () => {
    const { preimage, hash } = HTLCHelper.generateSecret();
    const policy: VtxoClaimPolicy = {
      type: 'conditional', owner: 'alice', refundOwner: 'bob', hashlock: hash, timeoutBlock: 100,
    };
    expect(verifyClaimPolicy(policy, { signers: ['alice'], preimage, path: 'claim' }, { block: 100 }).valid).toBe(true);
    expect(verifyClaimPolicy(policy, { signers: ['alice'], path: 'claim' }, { block: 100 }).valid).toBe(false);
    expect(verifyClaimPolicy(policy, { signers: ['bob'], path: 'refund' }, { block: 101 }).valid).toBe(true);
    expect(verifyClaimPolicy(policy, { signers: ['alice'], preimage, path: 'claim' }, { block: 101 }).valid).toBe(false);
  });
});

describe('multiparty VTXO — M10 atomic DvP claim', () => {
  it('requires both parties, matching HTLC id/hashlock and preimage', () => {
    const { preimage, hash } = HTLCHelper.generateSecret();
    const policy: VtxoClaimPolicy = {
      type: 'dvp', owner: 'alice', counterparty: 'bob', paymentId: 'htlc-1', hashlock: hash, timeoutBlock: 100,
    };
    const htlc = { paymentId: 'htlc-1', hashlock: hash, status: 'pending' as const };
    expect(verifyClaimPolicy(policy, { signers: ['alice', 'bob'], preimage }, { block: 50, htlc }).valid).toBe(true);
    expect(verifyClaimPolicy(policy, { signers: ['alice'], preimage }, { block: 50, htlc }).valid).toBe(false);
    expect(verifyClaimPolicy(policy, { signers: ['alice', 'bob'], preimage }, { block: 50, htlc: { ...htlc, paymentId: 'other' } }).valid).toBe(false);
    expect(verifyClaimPolicy(policy, { signers: ['alice', 'bob'], preimage: '0x' + '00'.repeat(32) }, { block: 50, htlc }).valid).toBe(false);
  });
});


describe('multiparty VTXO — M11 delegated claim', () => {
  it('allows scoped delegate claims before expiry and rejects expired/revoked/wrong-scope use', () => {
    const policy: VtxoClaimPolicy = {
      type: 'delegated', owner: 'alice', delegate: 'agent', scope: 'claim', expiresAtBlock: 100,
    };
    expect(verifyClaimPolicy(policy, { signers: ['agent'], scope: 'claim' }, { block: 50 }).valid).toBe(true);
    expect(verifyClaimPolicy(policy, { signers: ['agent'], scope: 'transfer' }, { block: 50 }).valid).toBe(false);
    expect(verifyClaimPolicy(policy, { signers: ['agent'], scope: 'claim' }, { block: 101 }).valid).toBe(false);
    expect(verifyClaimPolicy({ ...policy, revoked: true }, { signers: ['agent'], scope: 'claim' }, { block: 50 }).valid).toBe(false);
  });
});

describe('multiparty VTXO — M12 operator rotation', () => {
  it('switches operator authority at the rotation block', () => {
    const policy: VtxoClaimPolicy = {
      type: 'rotation', fromOperator: 'op-old', toOperator: 'op-new', rotateAtBlock: 100,
    };
    expect(verifyClaimPolicy(policy, { signers: ['op-old'] }, { block: 99 }).valid).toBe(true);
    expect(verifyClaimPolicy(policy, { signers: ['op-new'] }, { block: 99 }).valid).toBe(false);
    expect(verifyClaimPolicy(policy, { signers: ['op-new'] }, { block: 100 }).valid).toBe(true);
    expect(verifyClaimPolicy(policy, { signers: ['op-old'] }, { block: 100 }).valid).toBe(false);
  });
});

describe('multiparty VTXO — M13 six-LP yield distribution', () => {
  it('distributes yield pro-rata with exact conservation', () => {
    const weights = Object.fromEntries(OWNERS.map((o, i) => [o, BigInt((i + 1) * 100)]));
    const shares = distributeYield(1_000_003n, weights);
    expect(Object.values(shares).reduce((a, b) => a + b, 0n)).toBe(1_000_003n);
    expect(shares[OWNERS[5]]).toBeGreaterThan(shares[OWNERS[0]]);
  });
});

describe('multiparty VTXO — M14 pool/token binding isolation', () => {
  it('rejects a claim bound to a different pool or token', () => {
    const policy: VtxoClaimPolicy = {
      type: 'single', owner: 'alice', binding: { poolId: 'pool-a', tokenId: '0x00' },
    };
    expect(verifyClaimPolicy(policy, { signers: ['alice'] }, { block: 1, poolId: 'pool-a', tokenId: '0x00' }).valid).toBe(true);
    expect(verifyClaimPolicy(policy, { signers: ['alice'] }, { block: 1, poolId: 'pool-b', tokenId: '0x00' }).valid).toBe(false);
    expect(verifyClaimPolicy(policy, { signers: ['alice'] }, { block: 1, poolId: 'pool-a', tokenId: '0x01' }).valid).toBe(false);
  });
});

describe('multiparty VTXO — M15 griefing/liveness', () => {
  it('does not let one owner block the other five exit drafts', () => {
    const pool = newPool('m15');
    const { vtxo } = mintVtxo(pool, { owner: 'operator-1', amount: 60_000n, nonce: 'm15-mint' }, NOW);
    const { outputs } = splitVtxo(vtxo, {
      amounts: OWNERS.map(() => 10_000n), nonces: OWNERS.map((o) => `m15-${o}`),
    }, NOW + 1);
    const claims = outputs.map((o, i) => transferVtxo(o, { recipient: OWNERS[i], amount: 10_000n, nonce: `m15-x-${i}` }, NOW + 2).output);
    // One owner's claim is withheld; the other five still produce exits.
    const exits = claims.slice(1).map((claim) => createExitDraft(claim, NOW + 3));
    expect(exits).toHaveLength(5);
    expect(exits.every((e) => e.draft.draftType === 'vtxo-exit')).toBe(true);
  });
});

describe('multiparty VTXO — M16 collateral release', () => {
  it('requires both parties and the release block', () => {
    const policy: VtxoClaimPolicy = {
      type: 'collateral', owner: 'alice', counterparty: 'bob', releaseAtBlock: 100,
    };
    expect(verifyClaimPolicy(policy, { signers: ['alice', 'bob'] }, { block: 100 }).valid).toBe(true);
    expect(verifyClaimPolicy(policy, { signers: ['alice'] }, { block: 100 }).valid).toBe(false);
    expect(verifyClaimPolicy(policy, { signers: ['alice', 'bob'] }, { block: 99 }).valid).toBe(false);
  });
});

describe('multiparty VTXO — M17 vesting/payroll', () => {
  it('enforces beneficiary, cliff, and a positive claim amount', () => {
    const policy: VtxoClaimPolicy = {
      type: 'vesting', owner: 'employer', beneficiary: 'alice', startBlock: 10, cliffBlock: 20, endBlock: 100,
    };
    expect(verifyClaimPolicy(policy, { signers: ['alice'], claimAmount: 100n }, { block: 20 }).valid).toBe(true);
    expect(verifyClaimPolicy(policy, { signers: ['alice'], claimAmount: 100n }, { block: 19 }).valid).toBe(false);
    expect(verifyClaimPolicy(policy, { signers: ['bob'], claimAmount: 100n }, { block: 30 }).valid).toBe(false);
    expect(verifyClaimPolicy(policy, { signers: ['alice'], claimAmount: 0n }, { block: 30 }).valid).toBe(false);
  });
});

describe('multiparty VTXO — M18 guardian recovery', () => {
  it('requires the recovery window and guardian threshold', () => {
    const policy: VtxoClaimPolicy = {
      type: 'recovery', owner: 'alice', guardians: ['g1', 'g2', 'g3'], threshold: 2, recoverAfterBlock: 100,
    };
    expect(verifyClaimPolicy(policy, { signers: ['g1', 'g2'] }, { block: 100 }).valid).toBe(true);
    expect(verifyClaimPolicy(policy, { signers: ['g1'] }, { block: 100 }).valid).toBe(false);
    expect(verifyClaimPolicy(policy, { signers: ['g1', 'g2'] }, { block: 99 }).valid).toBe(false);
  });
});


describe('VTXO V1 — transferable exit entitlement', () => {
  it('binds the exit transaction to the exact owner/amount/pool and detects tampering', async () => {
    const pool = newPool('v1');
    const { vtxo } = mintVtxo(pool, { owner: 'alice', amount: 5_000n, nonce: 'v1-mint' }, NOW);
    const params = {
      vtxo,
      fundingCoinId: '0x' + 'cc'.repeat(32),
      fundingAddress: '0x' + 'dd'.repeat(32),
      fundingScript: 'RETURN TRUE',
      amount: 5_000n,
      holders: ['alice'],
      shares: [5_000n],
      holderIndex: 0,
      root: vtxo.proof.root,
      epoch: vtxo.epoch,
      exitBlock: 100,
    };
    const result = await buildExitTransaction(params, {
      signDigest: async () => new Uint8Array(1088).fill(1),
      coinProofs: [new Uint8Array([1])],
      scriptProofs: [new Uint8Array([2])],
    });
    const entitlement = createVtxoExitEntitlement(params, result);
    expect(verifyVtxoExitEntitlement(entitlement, vtxo).valid).toBe(true);
    expect(verifyVtxoExitEntitlement({ ...entitlement, owner: 'mallory' }, vtxo).valid).toBe(false);
    expect(verifyVtxoExitEntitlement({ ...entitlement, amount: '1' }, vtxo).valid).toBe(false);
    expect(verifyVtxoExitEntitlement({ ...entitlement, digest: '0x' + '00'.repeat(32) }, vtxo).valid).toBe(false);

    const transferred = transferVtxo(vtxo, {
      recipient: 'bob', amount: vtxo.amount, nonce: 'v1-x', exitEntitlement: entitlement,
    }, NOW + 1);
    expect(transferred.output.exitEntitlement).toEqual(entitlement);
    expect(() => transferVtxo(vtxo, {
      recipient: 'mallory', amount: vtxo.amount, nonce: 'v1-bad',
      exitEntitlement: { ...entitlement, owner: 'mallory' },
    }, NOW + 2)).toThrow(/entitlement/);
  });
});


describe('VTXO V1 — guarded transfer builder', () => {
  it('builds and verifies the recipient exit before transferring', async () => {
    const pool = newPool('v1-guarded');
    const { vtxo } = mintVtxo(pool, { owner: 'alice', amount: 3_000n, nonce: 'v1g-mint' }, NOW);
    const exitParams = {
      vtxo,
      fundingCoinId: '0x' + 'cc'.repeat(32),
      fundingAddress: '0x' + 'dd'.repeat(32),
      fundingScript: 'RETURN TRUE',
      amount: 3_000n,
      holders: ['alice'],
      shares: [3_000n],
      holderIndex: 0,
      root: vtxo.proof.root,
      epoch: vtxo.epoch,
      exitBlock: 100,
    };
    const deps = {
      signDigest: async () => new Uint8Array(1088).fill(1),
      coinProofs: [new Uint8Array([1])],
      scriptProofs: [new Uint8Array([2])],
    };
    const result = await transferVtxoWithExit(vtxo, {
      recipient: 'bob', amount: 3_000n, nonce: 'v1g-x',
    }, exitParams, deps, NOW + 1);
    expect(result.output.owner).toBe('bob');
    expect(result.output.exitEntitlement).toEqual(result.exitEntitlement);
    expect(verifyVtxoExitEntitlement(result.exitEntitlement, vtxo).valid).toBe(true);
  });
});
