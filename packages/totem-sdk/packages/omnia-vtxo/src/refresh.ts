import { OmniaVtxo, RefreshVtxoParams, RefreshResult, VtxoOperatorReceipt } from './types.js';
import { VtxoStatusError, VtxoPolicyError } from './errors.js';
import { computeVtxoId, buildVtxoProofSet, computeReceiptId } from './commitment.js';
import { MOCK_BATCH_ID, MOCK_OPERATOR_SIGNATURE } from './constants.js';

/**
 * Refreshes a VTXO to a new epoch.
 * @param now - Timestamp in ms. Defaults to Date.now() if omitted — pass explicitly for determinism.
 */
export function refreshVtxo(
  vtxo: OmniaVtxo,
  params: RefreshVtxoParams,
  now?: number,
): RefreshResult & { receipt: VtxoOperatorReceipt } {
  const ts = now !== undefined ? now : Date.now();

  if (vtxo.status !== 'active') {
    throw new VtxoStatusError(
      `Cannot refresh VTXO ${vtxo.vtxoId}: status is '${vtxo.status}'`,
      vtxo.status,
    );
  }

  if (params.newEpoch <= vtxo.epoch) {
    throw new VtxoPolicyError(
      `Refresh epoch ${params.newEpoch} must be strictly greater than current epoch ${vtxo.epoch}`
    );
  }

  const refreshedId = computeVtxoId({
    poolId: vtxo.poolId,
    owner: vtxo.owner,
    amount: vtxo.amount,
    tokenId: vtxo.tokenId,
    nonce: params.nonce,
  });

  const oldVtxo: OmniaVtxo = {
    ...vtxo,
    status: 'refreshed',
    updatedAt: ts,
    history: [
      ...vtxo.history,
      {
        op: 'refresh',
        at: ts,
        relatedIds: [refreshedId],
        meta: { newEpoch: params.newEpoch },
      },
    ],
  };

  const rawRefreshed: OmniaVtxo = {
    vtxoId: refreshedId,
    poolId: vtxo.poolId,
    owner: vtxo.owner,
    amount: vtxo.amount,
    tokenId: vtxo.tokenId,
    status: 'active',
    epoch: params.newEpoch,
    proof: {
      leaf: '',
      root: '',
      siblings: [],
      positions: [],
      epoch: params.newEpoch,
      batchId: MOCK_BATCH_ID,
    },
    history: [
      {
        op: 'refresh',
        at: ts,
        relatedIds: [vtxo.vtxoId],
        meta: { prevEpoch: vtxo.epoch, newEpoch: params.newEpoch },
      },
    ],
    createdAt: ts,
    updatedAt: ts,
    expiresAt: vtxo.expiresAt,
  };

  const { proofs } = buildVtxoProofSet([rawRefreshed]);
  const refreshedVtxo: OmniaVtxo = { ...rawRefreshed, proof: proofs[refreshedId] };

  const receiptId = computeReceiptId(
    vtxo.poolId, 'refresh', [vtxo.vtxoId], [refreshedId], ts
  );

  return {
    old: oldVtxo,
    refreshed: refreshedVtxo,
    receipt: {
      receiptId,
      poolId: vtxo.poolId,
      op: 'refresh',
      inputIds: [vtxo.vtxoId],
      outputIds: [refreshedId],
      epoch: params.newEpoch,
      at: ts,
      signature: MOCK_OPERATOR_SIGNATURE,
    },
  };
}
