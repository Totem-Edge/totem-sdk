/**
 * OMN-025 — an exit entitlement is only as good as the witness behind it, and
 * its funding coin must belong to the authoritative pool.
 */

import { createPool } from '../pool.js';
import { mintVtxo } from '../vtxo.js';
import { createExitDraft } from '../exit.js';
import { buildExitTransaction, type ExitTxParams } from '../exit-tx.js';
import { createVtxoExitEntitlement, verifyVtxoExitEntitlement } from '../exit-entitlement.js';
import type { OmniaVtxo, OmniaVtxoPool } from '../types.js';

const NOW = 1_000_000;

function setup(): { pool: OmniaVtxoPool; vtxo: OmniaVtxo } {
  const pool = createPool({
    operator: 'MxOPERATOR',
    tokenId: '0x00',
    totalCapacity: 1_000_000n,
    nonce: 'om25',
  }, NOW);
  const { pool: next, vtxo } = mintVtxo(pool, {
    owner: 'alice',
    amount: 100_000n,
    nonce: 'om25-mint',
  }, NOW + 1);
  return { pool: next, vtxo };
}

async function entitlementFor(vtxo: OmniaVtxo) {
  const params: ExitTxParams = {
    vtxo,
    fundingCoinId: '0x' + '11'.repeat(32),
    fundingAddress: '0x' + 'dd'.repeat(32),
    fundingScript: 'RETURN TRUE',
    amount: vtxo.amount,
    holders: [vtxo.owner],
    shares: [vtxo.amount],
    holderIndex: 0,
    root: vtxo.proof.root,
    epoch: vtxo.epoch,
    exitBlock: 500,
    exitDelay: 10,
  };
  const result = await buildExitTransaction(params, {
    signDigest: async () => new Uint8Array(1088).fill(1),
    coinProofs: [new Uint8Array([1, 2, 3])],
    scriptProofs: [new Uint8Array([4, 5, 6])],
  });
  return createVtxoExitEntitlement(params, result);
}

describe('OMN-025 exit entitlement witness and pool anchoring', () => {
  it('rejects an entitlement whose witness nothing can verify', async () => {
    const { vtxo } = setup();
    const entitlement = await entitlementFor(vtxo);
    const result = verifyVtxoExitEntitlement(entitlement, vtxo);
    expect(result.valid).toBe(false);
    expect(result.errors.join('; ')).toMatch(/witness is not verified/);
  });

  it('accepts a locally built entitlement when the caller opts out', async () => {
    const { vtxo } = setup();
    const entitlement = await entitlementFor(vtxo);
    expect(verifyVtxoExitEntitlement(entitlement, vtxo, { requireWitness: false }).valid).toBe(true);
  });

  it('rejects a witness the verifier does not accept', async () => {
    const { vtxo } = setup();
    const entitlement = await entitlementFor(vtxo);
    const result = verifyVtxoExitEntitlement(entitlement, vtxo, {
      verifyWitness: () => false,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('exit witness does not verify');
  });

  it('anchors the funding coin to the pool backing', async () => {
    const { pool, vtxo } = setup();
    const entitlement = await entitlementFor(vtxo);
    const backed: OmniaVtxoPool = {
      ...pool,
      backing: {
        coinId: '0x' + '99'.repeat(32),
        amount: 1_000_000n,
        tokenId: '0x00',
        confirmations: 3,
        verifiedAt: NOW,
        address: '0x' + 'dd'.repeat(32),
      },
    };
    const result = verifyVtxoExitEntitlement(entitlement, vtxo, {
      verifyWitness: () => true,
      pool: backed,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join('; ')).toMatch(/funding coin is not the pool backing coin/);

    const ok = verifyVtxoExitEntitlement(entitlement, vtxo, {
      verifyWitness: () => true,
      pool: {
        ...backed,
        backing: { ...backed.backing!, coinId: '0x' + '11'.repeat(32) },
        epochRoots: [...pool.epochRoots, { epoch: vtxo.epoch, root: vtxo.proof.root, at: NOW }],
      },
    });
    expect(ok.valid).toBe(true);
  });

  it('rejects an epoch the pool never published', async () => {
    const { pool, vtxo } = setup();
    const entitlement = await entitlementFor(vtxo);
    const result = verifyVtxoExitEntitlement(entitlement, vtxo, {
      verifyWitness: () => true,
      pool: {
        ...pool,
        epoch: vtxo.epoch + 5,
        epochRoots: [],
        backing: {
          coinId: '0x' + '11'.repeat(32),
          amount: 1_000_000n,
          tokenId: '0x00',
          confirmations: 1,
          verifiedAt: NOW,
          address: '0x' + 'dd'.repeat(32),
        },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join('; ')).toMatch(/not a published pool epoch/);
  });
});
