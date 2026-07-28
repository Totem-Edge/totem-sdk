import { F, bytesToHex } from '@totemsdk/core';
import type {
  LiquidityReceipt,
  LiquidityBondVerifyResult,
  IssueLiquidityReceiptParams,
  VerifyLiquidityReceiptParams,
} from './types.js';
import { canonicalJson } from './serialization.js';

let receiptCounter = 0;

export function issueLiquidityReceipt(params: IssueLiquidityReceiptParams): LiquidityReceipt {
  const now = params.issuedAt ?? Date.now();
  receiptCounter++;
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
    proofRef: params.proofRef,
    metadata: params.metadata,
  };
  receipt.receiptHash = computeLiquidityReceiptHash(receipt);
  return receipt;
}

export function computeLiquidityReceiptHash(receipt: LiquidityReceipt): string {
  const { receiptHash, ...rest } = receipt;
  const json = canonicalJson(rest);
  return bytesToHex(F(new TextEncoder().encode(json)));
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

  return { ok: true, code: 'OK' };
}
