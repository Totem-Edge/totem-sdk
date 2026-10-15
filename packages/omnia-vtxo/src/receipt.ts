/**
 * VTXO receipt co-signing (RFC-038 V0).
 *
 * A mutation emits its `VtxoOperatorReceipt` **unsigned** (retiring the mock
 * constant); the operator then co-signs it by signing the canonical batch
 * commitment over the receipt's pool/epoch/root/output ids. This is the
 * operator's authorising step, and the signature is verifiable against the
 * operator's tree-root public key.
 */

import { computeBatchCommitmentBytes } from './commitment.js';
import type { OmniaVtxoOperator, VtxoOperatorReceipt } from './types.js';

/**
 * Co-sign a receipt with the operator. `root` is the epoch batch root the
 * receipt's outputs were committed under.
 */
export async function signVtxoReceipt(
  operator: OmniaVtxoOperator,
  receipt: VtxoOperatorReceipt,
  root: string,
): Promise<VtxoOperatorReceipt> {
  const data = computeBatchCommitmentBytes(receipt.poolId, receipt.epoch, root, receipt.outputIds);
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
  const data = computeBatchCommitmentBytes(receipt.poolId, receipt.epoch, root, receipt.outputIds);
  return operator.verify(data, receipt.signature);
}
