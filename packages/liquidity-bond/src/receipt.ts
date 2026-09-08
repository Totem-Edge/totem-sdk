import { F, bytesToHex } from '@totemsdk/core';
import type {
  LiquidityReceipt,
  LiquidityBondVerifyResult,
  IssueLiquidityReceiptParams,
  VerifyLiquidityReceiptParams,
} from './types.js';
import { canonicalJson } from './serialization.js';

export const RECEIPT_HASH_DOMAIN = 'totemsdk/liquidity-bond/receipt/v1';

let receiptCounter = 0;

export function issueLiquidityReceipt(params: IssueLiquidityReceiptParams): LiquidityReceipt {
  const now = params.issuedAt ?? Date.now();
  receiptCounter++;
  const nonce = `${now}-${receiptCounter}`;
  const receipt: LiquidityReceipt = {
    receiptId: `rcpt-${now}-${receiptCounter}`,
    positionId: params.position.positionId,
    poolId: params.poolId,
    ownerAddress: params.ownerAddress,
    ownerIdentityId: params.ownerIdentityId,
    asset: params.position.asset,
    amount: params.position.amount,
    effectiveAmount: params.position.effectiveAmount,
    issuedAt: now,
    expiresAt: params.expiresAt,
    receiptHash: '',
    nonce,
    proofRef: params.proofRef,
    metadata: params.metadata,
  };
  receipt.receiptHash = computeLiquidityReceiptHash(receipt);
  return receipt;
}

/**
 * Domain-separated receipt hash (#33): scoped to the receipt domain so a hash
 * computed over one record cannot replay against another.
 */
export function computeLiquidityReceiptHash(receipt: LiquidityReceipt): string {
  const { receiptHash, ...rest } = receipt;
  const json = canonicalJson(rest);
  return bytesToHex(F(new TextEncoder().encode(`${RECEIPT_HASH_DOMAIN}|${json}`)));
}

export function verifyLiquidityReceipt(params: VerifyLiquidityReceiptParams): LiquidityBondVerifyResult {
  const { receipt, position } = params;

  if (receipt.positionId !== position.positionId) {
    return { ok: false, reason: 'Receipt position ID does not match', code: 'RECEIPT_INVALID' };
  }

  if (receipt.ownerAddress !== position.lpAddress) {
    return { ok: false, reason: 'Receipt owner does not match position LP', code: 'RECEIPT_OWNER_NOT_AUTHORISED' };
  }

  const computedHash = computeLiquidityReceiptHash(receipt);
  if (computedHash !== receipt.receiptHash) {
    return { ok: false, reason: 'Receipt hash mismatch', code: 'RECEIPT_INVALID' };
  }

  if (receipt.consumedAt !== undefined) {
    return { ok: false, reason: 'Receipt has already been consumed', code: 'RECEIPT_INVALID' };
  }

  return { ok: true, code: 'OK' };
}

/**
 * Consume a receipt for a withdrawal — single-spend (#8). A consumed receipt
 * can never be replayed against another withdrawal.
 */
export function consumeLiquidityReceipt(
  receipt: LiquidityReceipt,
  intentId: string,
  now?: number,
): LiquidityReceipt {
  if (receipt.consumedAt !== undefined) {
    throw new Error(`receipt ${receipt.receiptId} has already been consumed by ${receipt.consumedIntentId}`);
  }
  const consumed: LiquidityReceipt = {
    ...receipt,
    consumedAt: now ?? Date.now(),
    consumedIntentId: intentId,
  };
  // Recompute the hash so the consumed record stays internally consistent
  // (consumedAt/consumedIntentId are part of the domain-separated hash).
  return { ...consumed, receiptHash: computeLiquidityReceiptHash(consumed) };
}
