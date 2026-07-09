import {
  OmniaVtxoPool,
  OmniaVtxo,
  MintVtxoParams,
  MintResult,
  VtxoOperatorReceipt,
} from './types.js';
import { VtxoStatusError } from './errors.js';
import { MOCK_BATCH_ID, MOCK_OPERATOR_SIGNATURE } from './constants.js';
import { computeVtxoId, buildVtxoProofSet, computeReceiptId } from './commitment.js';
import { assertPoolCanMint } from './pool.js';

export function isVtxoActive(vtxo: OmniaVtxo): boolean {
  return vtxo.status === 'active';
}

/**
 * Mints a new VTXO against a pool.
 * @param pool - The pool to mint from.
 * @param params - Mint parameters (owner, amount, nonce).
 * @param now - Timestamp in ms. Defaults to Date.now() if omitted — pass explicitly for determinism.
 */
export function mintVtxo(
  pool: OmniaVtxoPool,
  params: MintVtxoParams,
  now?: number,
): MintResult {
  const ts = now !== undefined ? now : Date.now();
  assertPoolCanMint(pool, params.amount);

  const vtxoId = computeVtxoId({
    poolId: pool.poolId,
    owner: params.owner,
    amount: params.amount,
    tokenId: pool.tokenId,
    nonce: params.nonce,
  });

  const vtxo: OmniaVtxo = {
    vtxoId,
    poolId: pool.poolId,
    owner: params.owner,
    amount: params.amount,
    tokenId: pool.tokenId,
    status: 'active',
    epoch: pool.epoch,
    proof: {
      leaf: '',
      root: '',
      siblings: [],
      positions: [],
      epoch: pool.epoch,
      batchId: MOCK_BATCH_ID,
    },
    history: [
      {
        op: 'mint',
        at: ts,
        to: params.owner,
        meta: { poolId: pool.poolId },
      },
    ],
    createdAt: ts,
    updatedAt: ts,
    expiresAt: params.expiresAt,
  };

  const { root, proofs } = buildVtxoProofSet([vtxo]);
  const proof = proofs[vtxoId];
  const mintedVtxo: OmniaVtxo = { ...vtxo, proof };

  const updatedPool: OmniaVtxoPool = {
    ...pool,
    availableCapacity: pool.availableCapacity - params.amount,
    commitmentRoot: root,
  };

  const receiptId = computeReceiptId(pool.poolId, 'mint', [], [vtxoId], ts);
  const receipt: VtxoOperatorReceipt = {
    receiptId,
    poolId: pool.poolId,
    op: 'mint',
    inputIds: [],
    outputIds: [vtxoId],
    epoch: pool.epoch,
    at: ts,
    signature: MOCK_OPERATOR_SIGNATURE,
  };

  return { pool: updatedPool, vtxo: mintedVtxo, receipt };
}

/**
 * Marks an active VTXO as spent.
 * @param now - Timestamp in ms. Defaults to Date.now() if omitted — pass explicitly for determinism.
 */
export function markVtxoSpent(vtxo: OmniaVtxo, now?: number): OmniaVtxo {
  const ts = now !== undefined ? now : Date.now();
  if (!isVtxoActive(vtxo)) {
    throw new VtxoStatusError(
      `Cannot mark VTXO ${vtxo.vtxoId} as spent: status is '${vtxo.status}'`,
      vtxo.status,
    );
  }
  return {
    ...vtxo,
    status: 'spent',
    updatedAt: ts,
    history: [
      ...vtxo.history,
      { op: 'spent', at: ts },
    ],
  };
}
