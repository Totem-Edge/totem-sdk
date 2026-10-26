/**
 * VTXO receipt co-signing (RFC-038 V0, verify-before-sign per §3.5).
 *
 * A mutation emits its `VtxoOperatorReceipt` **unsigned**; the operator co-signs
 * it only after **recomputing** the batch root from the batch's leaves and
 * checking epoch monotonicity, output membership, and (when supplied) amount
 * conservation. This prevents a caller from getting the operator to co-sign an
 * arbitrary `(root, epoch, ids)` tuple whose root does not commit the outputs.
 */

import { computeCommitmentRoot, computeVtxoLeaf, computeVtxoReceiptCommitmentBytes } from './commitment.js';
import type { OmniaVtxo, OmniaVtxoOperator, VtxoOperatorReceipt } from './types.js';

/** The batch the receipt belongs to — the operator's source of truth. */
export interface VtxoReceiptBatch {
  /** The VTXOs committed in this epoch's batch. */
  outputs: OmniaVtxo[];
  /** The batch root the receipt claims (the operator recomputes and compares). */
  root: string;
  /** The batch epoch. */
  epoch: number;
  /** The pool's current epoch, for monotonicity (must be strictly less). */
  previousEpoch?: number;
  /** Optional: total input amount, for a conservation check. */
  inputsAmount?: bigint;
}

/**
 * Co-sign a receipt with the operator, after verifying the batch.
 * @throws if the root does not commit the leaves, the epoch is stale, an output
 * is not in the batch, or conservation fails.
 */
export function buildVtxoReceiptPayload(
  receipt: VtxoOperatorReceipt,
  batch: VtxoReceiptBatch,
): Uint8Array {
  if (receipt.epoch !== batch.epoch) {
    throw new Error(`receipt epoch ${receipt.epoch} does not match batch epoch ${batch.epoch}`);
  }
  if (batch.previousEpoch !== undefined && batch.epoch <= batch.previousEpoch) {
    throw new Error(`batch epoch ${batch.epoch} is not greater than the pool epoch ${batch.previousEpoch}`);
  }

  const idSet = new Set(batch.outputs.map((v) => v.vtxoId));
  for (const id of receipt.outputIds) {
    if (!idSet.has(id)) throw new Error(`receipt output '${id}' is not a VTXO in the batch`);
  }

  const recomputedRoot = computeCommitmentRoot(batch.outputs.map(computeVtxoLeaf));
  if (recomputedRoot !== batch.root) {
    throw new Error('batch root does not commit the batch leaves');
  }

  const outputSum = batch.outputs.reduce((sum, v) => sum + v.amount, 0n);
  if (receipt.op !== 'mint') {
    if (batch.inputsAmount === undefined) {
      throw new Error(`conservation required for ${receipt.op} receipts`);
    }
    if (outputSum !== batch.inputsAmount) {
      throw new Error(`conservation violated: outputs ${outputSum} != inputs ${batch.inputsAmount}`);
    }
  }

  return computeVtxoReceiptCommitmentBytes(receipt, batch.root);
}

export async function signVtxoReceipt(
  operator: OmniaVtxoOperator,
  receipt: VtxoOperatorReceipt,
  batch: VtxoReceiptBatch,
): Promise<VtxoOperatorReceipt> {
  const data = buildVtxoReceiptPayload(receipt, batch);
  const signature = await operator.sign(data);
  return { ...receipt, signature };
}

/** Verify a co-signed receipt against the operator and the batch root. */
export async function verifyVtxoReceipt(
  operator: OmniaVtxoOperator,
  receipt: VtxoOperatorReceipt,
  root: string,
): Promise<boolean> {
  if (!receipt.signature) return false;
  const data = computeVtxoReceiptCommitmentBytes(receipt, root);
  return operator.verify(data, receipt.signature);
}
