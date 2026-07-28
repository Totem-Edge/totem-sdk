import { F, hex } from '@totemsdk/core';
import type { PaymentRequest } from './types.js';

/**
 * Generate a random 32-byte preimage, compute SHA3-256(preimage) as the
 * hashlock, and return a PaymentRequest that is ready to share.
 *
 * The returned PaymentRequest includes the `preimage` field so the payer
 * can call executeMultiHopPayment.  Strip `preimage` before forwarding the
 * request to intermediaries.
 *
 * Compatible with Bare/Pear environments: uses globalThis.crypto.getRandomValues
 * (Web Crypto API, available in Node ≥18, browsers, and Pear/Bare runtimes).
 */
export function buildPaymentRequest(
  amount:       bigint,
  tokenId:      string,
  expiryBlock:  bigint,
  description?: string,
): PaymentRequest {
  const preimageBytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(preimageBytes);
  const preimage = '0x' + hex(preimageBytes);
  const hashlock = '0x' + hex(F(preimageBytes));

  return {
    hashlock,
    preimage,
    amount,
    tokenId,
    expiryBlock,
    description,
  };
}

/**
 * Recipient-side variant: generates a payment request for the token they want
 * to receive.  The API is identical to buildPaymentRequest — the distinction
 * is conceptual (recipient generates hashlock; sender sources liquidity).
 */
export function buildCrossTokenRequest(
  amountOut:    bigint,
  tokenOut:     string,
  expiryBlock:  bigint,
  description?: string,
): PaymentRequest {
  return buildPaymentRequest(amountOut, tokenOut, expiryBlock, description);
}
