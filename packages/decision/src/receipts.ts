/**
 * @module @totemsdk/decision/receipts
 *
 * Unsigned advisory decision receipts (v1).
 *
 * `hashes ≠ proof of neural correctness`
 * `DecisionReceipt ≠ cryptographic authorization ≠ signed attestation`
 *
 * The `receiptId` is derived, not caller-supplied: a domain-separated canonical
 * hash of the receipt body excluding `receiptId` (RFC-012 §29.1).
 */

import { hashCanonical } from '@totemsdk/core';
import { DECISION_DIGEST_DOMAINS } from './constants.js';
import type { DecisionReceipt, DecisionReceiptBody } from './types.js';

/** Derive the receipt id from a receipt body. */
export function computeReceiptId(body: DecisionReceiptBody): string {
  return hashCanonical(DECISION_DIGEST_DOMAINS.receipt, body);
}

/** Build a v1 receipt, deriving `receiptId` from the body. */
export function createDecisionReceipt(body: DecisionReceiptBody): DecisionReceipt {
  return { ...body, receiptId: computeReceiptId(body) };
}

/** Verify that a receipt's id matches its body (tamper detection, not proof). */
export function verifyDecisionReceiptId(receipt: DecisionReceipt): boolean {
  const { receiptId, ...body } = receipt;
  return computeReceiptId(body) === receiptId;
}
