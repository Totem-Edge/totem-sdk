import { OmniaVtxo, MergeVtxosParams, MergeResult, VtxoOperatorReceipt } from './types.js';
import { VtxoStatusError, VtxoMergeError, VtxoOwnershipError } from './errors.js';
import { computeVtxoId, buildVtxoProofSet, computeReceiptId } from './commitment.js';
import { MOCK_BATCH_ID, MOCK_OPERATOR_SIGNATURE } from './constants.js';

/**
 * Merges multiple VTXOs into one.
 * @param now - Timestamp in ms. Defaults to Date.now() if omitted — pass explicitly for determinism.
 */
export function mergeVtxos(
  vtxos: OmniaVtxo[],
  params: MergeVtxosParams,
  now?: number,
): MergeResult & { receipt: VtxoOperatorReceipt } {
  const ts = now !== undefined ? now : Date.now();

  if (vtxos.length < 2) {
    throw new VtxoMergeError('Merge requires at least 2 VTXOs');
  }

  const ids = vtxos.map(v => v.vtxoId);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    throw new VtxoMergeError('Duplicate VTXO IDs detected in merge — double-counting prevented');
  }

  for (const vtxo of vtxos) {
    if (vtxo.status !== 'active') {
      throw new VtxoStatusError(
        `Cannot merge VTXO ${vtxo.vtxoId}: status is '${vtxo.status}'`,
        vtxo.status,
      );
    }
  }

  const poolId = vtxos[0].poolId;
  const tokenId = vtxos[0].tokenId;
  const inputOwner = vtxos[0].owner;

  for (const vtxo of vtxos) {
    if (vtxo.poolId !== poolId) {
      throw new VtxoMergeError(
        `Cannot merge VTXOs from different pools: ${vtxo.poolId} vs ${poolId}`
      );
    }
    if (vtxo.tokenId !== tokenId) {
      throw new VtxoMergeError(
        `Cannot merge VTXOs with different tokenIds: ${vtxo.tokenId} vs ${tokenId}`
      );
    }
    if (vtxo.owner !== inputOwner) {
      throw new VtxoOwnershipError(
        `Cannot merge VTXOs with different owners: ${vtxo.owner} vs ${inputOwner}`
      );
    }
  }

  if (params.owner !== inputOwner) {
    throw new VtxoOwnershipError(
      `Merge output owner '${params.owner}' must match input owner '${inputOwner}'`
    );
  }

  const totalAmount = vtxos.reduce((sum, v) => sum + v.amount, BigInt(0));

  const outputId = computeVtxoId({
    poolId,
    owner: params.owner,
    amount: totalAmount,
    tokenId,
    nonce: params.nonce,
  });

  const inputVtxos: OmniaVtxo[] = vtxos.map(vtxo => ({
    ...vtxo,
    status: 'merged' as const,
    updatedAt: ts,
    history: [
      ...vtxo.history,
      {
        op: 'merge' as const,
        at: ts,
        relatedIds: [outputId],
      },
    ],
  }));

  const rawOutput: OmniaVtxo = {
    vtxoId: outputId,
    poolId,
    owner: params.owner,
    amount: totalAmount,
    tokenId,
    status: 'active' as const,
    epoch: vtxos[0].epoch,
    proof: {
      leaf: '',
      root: '',
      siblings: [],
      positions: [],
      epoch: vtxos[0].epoch,
      batchId: MOCK_BATCH_ID,
    },
    history: [
      {
        op: 'merge' as const,
        at: ts,
        relatedIds: ids,
      },
    ],
    createdAt: ts,
    updatedAt: ts,
  };

  const { proofs } = buildVtxoProofSet([rawOutput]);
  const output: OmniaVtxo = { ...rawOutput, proof: proofs[outputId] };

  const receiptId = computeReceiptId(poolId, 'merge', ids, [outputId], ts);

  return {
    inputs: inputVtxos,
    output,
    receipt: {
      receiptId,
      poolId,
      op: 'merge',
      inputIds: ids,
      outputIds: [outputId],
      epoch: vtxos[0].epoch,
      at: ts,
      signature: MOCK_OPERATOR_SIGNATURE,
    },
  };
}
