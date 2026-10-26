import { OmniaVtxo, TransferVtxoParams, TransferResult, VtxoTransfer, VtxoOperatorReceipt } from './types.js';
import { VtxoStatusError, VtxoAmountError } from './errors.js';
import { computeVtxoId, buildVtxoProofSet, computeReceiptId } from './commitment.js';
import { verifyVtxoExitEntitlement, createVtxoExitEntitlement, type VtxoExitEntitlement } from './exit-entitlement.js';
import { buildExitTransaction, type ExitTxParams, type ExitTxDeps } from './exit-tx.js';


/**
 * Transfers a VTXO (fully or partially) to a recipient.
 *
 * **Offline safety.** The returned output VTXOs are new claims. A Merkle proof
 * establishes membership in a committed set; it does NOT prove the input was
 * never spent elsewhere. The local host rejects a second transfer through its
 * shared state, but disconnected receivers do not share that state. Treat a
 * received VTXO as final only after an anti-double-spend check (online/operator
 * spend check, operator-co-signed transfer, or an explicitly risk-bounded
 * policy), and have the operator commit the new outputs — they do not
 * automatically belong to the previous pool root.
 *
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
  if (params.exitEntitlement) {
    if (params.amount !== vtxo.amount) {
      throw new VtxoAmountError('exit entitlement requires a full-value transfer');
    }
    const check = verifyVtxoExitEntitlement(params.exitEntitlement, vtxo);
    if (!check.valid) {
      throw new VtxoAmountError(`invalid exit entitlement: ${check.errors.join('; ')}`);
    }
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
    ...(params.exitEntitlement ? { exitEntitlement: params.exitEntitlement } : {}),
    proof: {
      leaf: '',
      root: '',
      siblings: [],
      positions: [],
      epoch: vtxo.epoch,
      batchId: '',
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
        batchId: '',
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
      signature: '',
    },
  };
}


/**
 * V1 transfer: build the recipient's independent exit before moving the claim,
 * then transfer only if the exit package verifies against the input VTXO.
 */
export async function transferVtxoWithExit(
  vtxo: OmniaVtxo,
  params: Omit<TransferVtxoParams, 'exitEntitlement'>,
  exitParams: ExitTxParams,
  exitDeps: ExitTxDeps,
  now?: number,
): Promise<TransferResult & { receipt: VtxoOperatorReceipt; exitEntitlement: VtxoExitEntitlement }> {
  if (exitParams.vtxo.vtxoId !== vtxo.vtxoId) {
    throw new VtxoAmountError('exit entitlement VTXO does not match transfer input');
  }
  if (params.amount !== vtxo.amount) {
    throw new VtxoAmountError('transferVtxoWithExit requires a full-value transfer');
  }
  const exit = await buildExitTransaction(exitParams, exitDeps);
  const entitlement = createVtxoExitEntitlement(exitParams, exit);
  const transferred = transferVtxo(vtxo, { ...params, exitEntitlement: entitlement }, now);
  return { ...transferred, exitEntitlement: entitlement };
}
