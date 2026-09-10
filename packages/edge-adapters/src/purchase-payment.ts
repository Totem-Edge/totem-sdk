/**
 * purchase-payment.ts — PurchasePaymentPort adapter with idempotency.
 *
 * Wraps any EdgePaymentPort (L1 Minima, L2 Omnia, hosted) and adds stable
 * idempotency-key dedup so a retry after a lost response never double-pays.
 *
 * The idempotency key is the stable purchase operation identity
 * (`purchaseId:agreementId:payment`) supplied by the purchasing layer. The
 * wrapper records the outcome of each key; a retry with the same key returns
 * the prior result without re-invoking the underlying payment port.
 *
 * If the underlying port cannot determine whether a payment succeeded, the
 * wrapper surfaces PAYMENT_STATE_UNKNOWN and stops automatic progression.
 */

import type { EdgeOperationResult } from '@totemsdk/edge';

export interface PaymentResult {
  txpowId?: string;
}

export interface PaymentPortLike {
  pay(params: {
    recipient: string;
    amount: string;
    tokenId?: string;
    memo?: string;
    idempotencyKey?: string;
  }): Promise<EdgeOperationResult<PaymentResult>>;
}

export interface PurchasePaymentAdapterConfig {
  /** The underlying payment port (L1/L2/hosted). */
  port: PaymentPortLike;
  /**
   * Optional durable idempotency store. When omitted, an in-memory map is
   * used (dev mode — no crash guarantees). A durable store (e.g. the
   * CommerceStore) makes retries safe across restarts.
   */
  store?: {
    get(key: string): Promise<EdgeOperationResult<PaymentResult> | undefined>;
    set(key: string, result: EdgeOperationResult<PaymentResult>): Promise<void>;
  };
}

/**
 * Create a PurchasePaymentPort with stable idempotency-key dedup.
 */
export function createPurchasePaymentAdapter(
  config: PurchasePaymentAdapterConfig,
): {
  pay(params: {
    recipient: string;
    amount: string;
    tokenId?: string;
    memo?: string;
    idempotencyKey?: string;
  }): Promise<EdgeOperationResult<PaymentResult>>;
} {
  const { port } = config;
  const memory = new Map<string, EdgeOperationResult<PaymentResult>>();
  const store = config.store ?? {
    get: async (key: string) => memory.get(key),
    set: async (key: string, result: EdgeOperationResult<PaymentResult>) => {
      memory.set(key, result);
    },
  };

  return {
    async pay(params) {
      const key = params.idempotencyKey;
      if (key) {
        const prior = await store.get(key);
        if (prior) {
          // Already attempted — return the prior result, never double-pay.
          return prior;
        }
      }

      const result = await port.pay(params);

      if (key) {
        await store.set(key, result);
      }
      return result;
    },
  };
}
