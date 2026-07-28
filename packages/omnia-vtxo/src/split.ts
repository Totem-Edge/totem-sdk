import { OmniaVtxo, SplitVtxoParams, SplitResult, VtxoOperatorReceipt } from './types.js';
import { VtxoStatusError, VtxoAmountError, VtxoSplitError } from './errors.js';
import { computeVtxoId, buildVtxoProofSet, computeReceiptId } from './commitment.js';
import { MOCK_BATCH_ID, MOCK_OPERATOR_SIGNATURE } from './constants.js';

/**
 * Splits a VTXO into multiple outputs.
 * @param now - Timestamp in ms. Defaults to Date.now() if omitted — pass explicitly for determinism.
 */
export function splitVtxo(
  vtxo: OmniaVtxo,
  params: SplitVtxoParams,
  now?: number,
): SplitResult & { receipt: VtxoOperatorReceipt } {
  const ts = now !== undefined ? now : Date.now();

  if (vtxo.status !== 'active') {
    throw new VtxoStatusError(
      `Cannot split VTXO ${vtxo.vtxoId}: status is '${vtxo.status}'`,
      vtxo.status,
    );
  }

  if (params.amounts.length < 2) {
    throw new VtxoSplitError('Split requires at least 2 output amounts');
  }

  if (params.amounts.length !== params.nonces.length) {
    throw new VtxoSplitError('amounts and nonces arrays must have the same length');
  }

  for (const amt of params.amounts) {
    if (amt <= BigInt(0)) {
      throw new VtxoAmountError(`All split amounts must be > 0, got ${amt}`);
    }
  }

  const sum = params.amounts.reduce((a, b) => a + b, BigInt(0));
  if (sum !== vtxo.amount) {
    throw new VtxoAmountError(
      `Split amounts sum ${sum} does not equal VTXO amount ${vtxo.amount}`
    );
  }

  const outputIds: string[] = params.amounts.map((amount, i) =>
    computeVtxoId({
      poolId: vtxo.poolId,
      owner: vtxo.owner,
      amount,
      tokenId: vtxo.tokenId,
      nonce: params.nonces[i],
    })
  );

  const inputVtxo: OmniaVtxo = {
    ...vtxo,
    status: 'split',
    updatedAt: ts,
    history: [
      ...vtxo.history,
      {
        op: 'split',
        at: ts,
        from: vtxo.owner,
        relatedIds: outputIds,
      },
    ],
  };

  const rawOutputs: OmniaVtxo[] = params.amounts.map((amount, i) => ({
    vtxoId: outputIds[i],
    poolId: vtxo.poolId,
    owner: vtxo.owner,
    amount,
    tokenId: vtxo.tokenId,
    status: 'active' as const,
    epoch: vtxo.epoch,
    proof: {
      leaf: '',
      root: '',
      siblings: [],
      positions: [],
      epoch: vtxo.epoch,
      batchId: MOCK_BATCH_ID,
    },
    history: [
      {
        op: 'split' as const,
        at: ts,
        from: vtxo.owner,
        relatedIds: [vtxo.vtxoId],
        meta: { splitIndex: i },
      },
    ],
    createdAt: ts,
    updatedAt: ts,
  }));

  const { proofs } = buildVtxoProofSet(rawOutputs);
  const outputs: OmniaVtxo[] = rawOutputs.map(o => ({ ...o, proof: proofs[o.vtxoId] }));

  const receiptId = computeReceiptId(vtxo.poolId, 'split', [vtxo.vtxoId], outputIds, ts);

  return {
    input: inputVtxo,
    outputs,
    receipt: {
      receiptId,
      poolId: vtxo.poolId,
      op: 'split',
      inputIds: [vtxo.vtxoId],
      outputIds,
      epoch: vtxo.epoch,
      at: ts,
      signature: MOCK_OPERATOR_SIGNATURE,
    },
  };
}
