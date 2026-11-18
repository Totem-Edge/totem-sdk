/**
 * OMN-003 — a transferred VTXO must not inherit the previous owner's exit
 * entitlement, and a transfer that carries an entitlement must have it verify
 * against the *recipient's* output VTXO.
 */

import { wotsAddressData } from '@totemsdk/core';
import { deserializeTxDraft } from '@totemsdk/omnia';
import { createPool } from '../pool';
import { mintVtxo } from '../vtxo';
import { transferVtxo, transferVtxoWithEntitlement } from '../transfer';
import { buildExitTransaction, type ExitTxParams, type ExitTxDeps } from '../exit-tx';
import {
  createVtxoExitEntitlement,
  verifyVtxoExitEntitlement,
} from '../exit-entitlement';
import { buildVtxoProofSet, computeVtxoId } from '../commitment';
import type { OmniaVtxo } from '../types';

const NOW = 1_000;
const FUNDING_COIN = '0x' + 'cc'.repeat(32);
const FUNDING_ADDRESS = '0x' + 'dd'.repeat(32);

const DEPS: ExitTxDeps = {
  signDigest: async () => new Uint8Array(1088).fill(1),
  coinProofs: [new Uint8Array([1])],
  scriptProofs: [new Uint8Array([2])],
};

function setup(amount = 5_000n) {
  const pool = createPool(
    { operator: 'op-1', tokenId: '0x00', totalCapacity: 1_000_000n, nonce: 'n1' },
    NOW,
  );
  const { vtxo } = mintVtxo(pool, { owner: 'alice', amount, nonce: 'mint-1' }, NOW);
  return { pool, vtxo };
}

function exitParams(vtxo: OmniaVtxo, overrides: Partial<ExitTxParams> = {}): ExitTxParams {
  return {
    vtxo,
    fundingCoinId: FUNDING_COIN,
    fundingAddress: FUNDING_ADDRESS,
    fundingScript: 'RETURN TRUE',
    amount: vtxo.amount,
    holders: [vtxo.owner],
    shares: [vtxo.amount],
    holderIndex: 0,
    root: vtxo.proof.root,
    epoch: vtxo.epoch,
    exitBlock: 100,
    ...overrides,
  };
}

async function sourceEntitlement(vtxo: OmniaVtxo) {
  const params = exitParams(vtxo);
  const result = await buildExitTransaction(params, DEPS);
  return createVtxoExitEntitlement(params, result);
}

/**
 * Build a genuinely recipient-bound entitlement for the output that a given
 * transfer will produce. Used to prove `transferVtxo` itself accepts a correct
 * recipient entitlement (not just via the helper).
 */
async function recipientEntitlement(vtxo: OmniaVtxo, recipient: string, nonce: string) {
  const outputId = computeVtxoId({
    poolId: vtxo.poolId,
    owner: recipient,
    amount: vtxo.amount,
    tokenId: vtxo.tokenId,
    nonce,
  });
  const raw: OmniaVtxo = {
    vtxoId: outputId,
    poolId: vtxo.poolId,
    owner: recipient,
    amount: vtxo.amount,
    tokenId: vtxo.tokenId,
    status: 'active',
    epoch: vtxo.epoch,
    proof: { leaf: '', root: '', siblings: [], positions: [], epoch: vtxo.epoch, batchId: '' },
    history: [],
    createdAt: NOW + 1,
    updatedAt: NOW + 1,
  };
  const { proofs } = buildVtxoProofSet([raw]);
  const output: OmniaVtxo = { ...raw, proof: proofs[outputId] };
  const params = exitParams(output);
  const result = await buildExitTransaction(params, DEPS);
  return { entitlement: createVtxoExitEntitlement(params, result), output };
}

describe('OMN-003 — transfer exit entitlement', () => {
  it('rejects the previous owner entitlement instead of copying it forward', async () => {
    const { vtxo } = setup();
    const aliceEntitlement = await sourceEntitlement(vtxo);
    expect(verifyVtxoExitEntitlement(aliceEntitlement, vtxo).valid).toBe(true);

    expect(() => transferVtxo(vtxo, {
      recipient: 'bob',
      amount: vtxo.amount,
      nonce: 'tx-1',
      exitEntitlement: aliceEntitlement,
    }, NOW + 1)).toThrow(/entitlement/);
  });

  it('reports explicitly when a transfer carries no entitlement', () => {
    const { vtxo } = setup();
    const transferred = transferVtxo(vtxo, {
      recipient: 'bob', amount: vtxo.amount, nonce: 'tx-1',
    }, NOW + 1);

    expect(transferred.exitReady).toBe(false);
    expect(transferred.exitEntitlement).toBeUndefined();
    expect(transferred.output.exitEntitlement).toBeUndefined();
  });

  it('never lets a partial transfer carry an exit entitlement', async () => {
    const { vtxo } = setup();
    const aliceEntitlement = await sourceEntitlement(vtxo);
    expect(() => transferVtxo(vtxo, {
      recipient: 'bob',
      amount: 1_000n,
      nonce: 'tx-partial',
      exitEntitlement: aliceEntitlement,
    }, NOW + 1)).toThrow(/full-value/);
  });

  it('accepts an entitlement that verifies for the recipient output', async () => {
    const { vtxo } = setup();
    const { entitlement, output: expectedOutput } = await recipientEntitlement(vtxo, 'bob', 'tx-2');

    const transferred = transferVtxo(vtxo, {
      recipient: 'bob',
      amount: vtxo.amount,
      nonce: 'tx-2',
      exitEntitlement: entitlement,
    }, NOW + 1);

    expect(transferred.exitReady).toBe(true);
    expect(transferred.output.vtxoId).toBe(expectedOutput.vtxoId);
    expect(transferred.output.exitEntitlement).toEqual(entitlement);
    expect(verifyVtxoExitEntitlement(transferred.output.exitEntitlement!, transferred.output).valid).toBe(true);
    // The same entitlement cannot verify for the previous owner.
    expect(verifyVtxoExitEntitlement(transferred.output.exitEntitlement!, vtxo).valid).toBe(false);
  });

  it('builds a recipient-bound exit with transferVtxoWithEntitlement', async () => {
    const { vtxo } = setup(3_000n);
    const params = exitParams(vtxo);

    const result = await transferVtxoWithEntitlement(
      vtxo,
      { recipient: 'bob', amount: 3_000n, nonce: 'tx-3' },
      params,
      DEPS,
      NOW + 1,
    );

    expect(result.exitReady).toBe(true);
    expect(result.output.owner).toBe('bob');
    expect(result.exitEntitlement.owner).toBe('bob');
    expect(result.exitEntitlement.vtxoId).toBe(result.output.vtxoId);
    expect(result.exitEntitlement.holderIndex).toBe(0);
    expect(result.exitEntitlement.holders[0]).toBe('bob');
    expect(result.exitEntitlement.root).toBe(result.output.proof.root);
    expect(verifyVtxoExitEntitlement(result.exitEntitlement, result.output).valid).toBe(true);
    expect(verifyVtxoExitEntitlement(result.exitEntitlement, vtxo).valid).toBe(false);

    // The rebuilt exit transaction pays the recipient, not the sender.
    const draft = deserializeTxDraft(result.exitEntitlement.txHex);
    expect(draft.outputs[0].address).toBe(wotsAddressData('bob'));
    expect(draft.outputs[0].amount).toBe(3_000n);
    expect(draft.inputs[0].coinId).toBe(FUNDING_COIN);
  });

  it('rejects an entitlement whose transaction data does not match the output', async () => {
    const { vtxo } = setup();
    const { entitlement } = await recipientEntitlement(vtxo, 'bob', 'tx-4');
    const tampered = { ...entitlement, owner: 'mallory' };

    expect(() => transferVtxo(vtxo, {
      recipient: 'bob',
      amount: vtxo.amount,
      nonce: 'tx-4',
      exitEntitlement: tampered,
    }, NOW + 1)).toThrow(/entitlement/);
  });
});
