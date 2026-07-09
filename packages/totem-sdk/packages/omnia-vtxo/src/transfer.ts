import { OmniaVtxo, TransferVtxoParams, TransferResult, VtxoTransfer, VtxoOperatorReceipt } from './types.js';
import { VtxoStatusError, VtxoAmountError } from './errors.js';
import { computeVtxoId, buildVtxoProofSet, computeReceiptId } from './commitment.js';
import { MOCK_BATCH_ID, MOCK_OPERATOR_SIGNATURE } from './constants.js';

/**
 * Transfers a VTXO (fully or partially) to a recipient.
 * @param now - Timestamp in ms. Defaults to Date.now() if omitted — pass explicitly for determinism.
 */
export function transferVtxo(
  vtxo: OmniaVtxo,
  params: TransferVtxoParams,
  now?: number,
): TransferResult & { receipt: VtxoOperatorReceipt } {
  const ts = now !== undefined ? now : Date.now();

  if (vtxo.status !== 'active') {
    throw new VtxoStatusError(
      `Cannot transfer VTXO ${vtxo.vtxoId}: status is '${vtxo.status}'`,
      vtxo.status,
    );
  }
  if (params.amount <= BigInt(0)) {
    throw new VtxoAmountError(`Transfer amount must be > 0, got ${params.amount}`);
  }
  if (params.amount > vtxo.amount) {
    throw new VtxoAmountError(
      `Transfer amount ${params.amount} exceeds VTXO amount ${vtxo.amount}`
    );
  }

  const isPartial = params.amount < vtxo.amount;
  const changeAmount = vtxo.amount - params.amount;

  const outputId = computeVtxoId({
    poolId: vtxo.poolId,
    owner: params.recipient,
    amount: params.amount,
    tokenId: vtxo.tokenId,
    nonce: params.nonce,
  });

  let changeVtxo: OmniaVtxo | undefined;
  let changeId: string | undefined;

  if (isPartial) {
    const changeNonce = params.changeNonce ?? params.nonce + ':change';
    changeId = computeVtxoId({
      poolId: vtxo.poolId,
      owner: vtxo.owner,
      amount: changeAmount,
      tokenId: vtxo.tokenId,
      nonce: changeNonce,
    });
  }

  const inputVtxo: OmniaVtxo = {
    ...vtxo,
    status: isPartial ? 'split' : 'transferred',
    updatedAt: ts,
    history: [
      ...vtxo.history,
      {
        op: isPartial ? 'split' : 'transfer',
        at: ts,
        from: vtxo.owner,
        to: params.recipient,
        relatedIds: changeId ? [outputId, changeId] : [outputId],
      },
    ],
  };

  const outputVtxo: OmniaVtxo = {
    vtxoId: outputId,
    poolId: vtxo.poolId,
    owner: params.recipient,
    amount: params.amount,
    tokenId: vtxo.tokenId,
    status: 'active',
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
        op: 'transfer',
        at: ts,
        from: vtxo.owner,
        to: params.recipient,
        relatedIds: [vtxo.vtxoId],
      },
    ],
    createdAt: ts,
    updatedAt: ts,
  };

  const outputIds = [outputId];

  if (isPartial && changeId) {
    changeVtxo = {
      vtxoId: changeId,
      poolId: vtxo.poolId,
      owner: vtxo.owner,
      amount: changeAmount,
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
          meta: { role: 'change' },
        },
      ],
      createdAt: ts,
      updatedAt: ts,
    };
    outputIds.push(changeId);
  }

  const activeOutputs = changeVtxo ? [outputVtxo, changeVtxo] : [outputVtxo];
  const { proofs } = buildVtxoProofSet(activeOutputs);

  const patchedOutput: OmniaVtxo = { ...outputVtxo, proof: proofs[outputId] };
  const patchedChange = changeVtxo
    ? { ...changeVtxo, proof: proofs[changeId!] }
    : undefined;

  const transfer: VtxoTransfer = {
    inputId: vtxo.vtxoId,
    outputId,
    changeId,
    from: vtxo.owner,
    to: params.recipient,
    amount: params.amount,
    changeAmount: isPartial ? changeAmount : undefined,
    poolId: vtxo.poolId,
    tokenId: vtxo.tokenId,
    at: ts,
  };

  const receiptId = computeReceiptId(vtxo.poolId, 'transfer', [vtxo.vtxoId], outputIds, ts);

  return {
    input: inputVtxo,
    output: patchedOutput,
    change: patchedChange,
    transfer,
    receipt: {
      receiptId,
      poolId: vtxo.poolId,
      op: 'transfer',
      inputIds: [vtxo.vtxoId],
      outputIds,
      epoch: vtxo.epoch,
      at: ts,
      signature: MOCK_OPERATOR_SIGNATURE,
    },
  };
}
