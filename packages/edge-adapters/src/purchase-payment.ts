/**
 * purchase-payment.ts — PurchasePaymentPort adapter with an atomic claim.
 *
 * Wraps any EdgePaymentPort (L1 Minima, L2 Omnia, hosted) and adds a stable
 * idempotency-key claim so a retry after a lost response never double-pays.
 *
 * The idempotency key is the stable purchase operation identity
 * (`purchaseId:agreementId:payment`) supplied by the purchasing layer. The
 * wrapper records an atomic pending marker (claim) *before* it invokes the
 * underlying payment port; only the caller that wins the claim pays. A retry
 * with the same key returns the prior result without re-invoking the port, and
 * a concurrent duplicate never double-pays — it either replays the completed
 * outcome or surfaces `PAYMENT_STATE_UNKNOWN` for an in-flight claim.
 *
 * Final exactly-once still depends on the payment system's own reconciliation:
 * if the process dies between the port accepting the payment and the outcome
 * being recorded, the key stays `pending`, and retries return
 * `PAYMENT_STATE_UNKNOWN` rather than risking a second payment. The owner
 * reconciles that window against the payment ledger.
 */

import type { EdgeOperationResult } from '@totemsdk/edge';
import {
  MemoryStore,
  assertCapabilities,
  type CasStore,
  type StorageAdapterWithCapabilities,
  type WriteAckMode,
} from '@totemsdk/storage';

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

/**
 * Idempotency claim record. `pending` is written atomically before the port
 * call; `completed` records the outcome. A `pending` key is never re-claimed
 * automatically — that is the double-pay guard.
 */
export type PurchasePaymentClaimRecord =
  | { phase: 'pending'; claimedAt: number }
  | { phase: 'completed'; result: EdgeOperationResult<PaymentResult>; completedAt: number };

/** The durable idempotency store must support conditional (CAS) writes. */
export type PurchasePaymentStore = StorageAdapterWithCapabilities & CasStore;

export interface PurchasePaymentAdapterConfig {
  /** The underlying payment port (L1/L2/hosted). */
  port: PaymentPortLike;
  /**
   * Optional claim store. When omitted, a dev in-memory store is used (no
   * crash guarantees and no cross-instance dedup). A durable CAS-capable
   * store (e.g. a `@totemsdk/storage` FileStore/SqliteStore) makes retries
   * safe across restarts and processes. No silent downgrade: a supplied
   * store is asserted CAS-capable and `durably-acknowledged` unless
   * `requireAckMode` opts into a weaker acknowledgment.
   */
  store?: PurchasePaymentStore;
  /** Key namespace prefix; default `totem_payment:v1:`. */
  namespace?: string;
  /** Required write acknowledgment for a supplied store; default `durably-acknowledged`. */
  requireAckMode?: WriteAckMode;
}

const DEFAULT_NAMESPACE = 'totem_payment:v1:';

/** In-process serialization so concurrent claims never double-pay on one store. */
const locks = new WeakMap<StorageAdapterWithCapabilities, Promise<unknown>>();

function withPaymentLock<V>(
  store: StorageAdapterWithCapabilities,
  fn: () => Promise<V>,
): Promise<V> {
  const tail = locks.get(store);
  const next = tail ? tail.then(fn, fn) : fn();
  const settled = next.catch(() => undefined);
  locks.set(store, settled);
  return next;
}

/**
 * Create a PurchasePaymentPort with an atomic idempotency-key claim.
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
  const namespace = config.namespace ?? DEFAULT_NAMESPACE;
  const store =
    config.store ??
    new MemoryStore(); // dev mode — volatile, process-local

  if (config.store) {
    // No silent downgrade: a consumer-supplied store must be able to claim
    // (CAS) and acknowledge durable writes unless explicitly opted out.
    assertCapabilities(store, {
      conditional: true,
      acknowledge: config.requireAckMode ?? 'durably-acknowledged',
    });
  }

  const keyFor = (idempotencyKey: string) => namespace + idempotencyKey;

  return {
    async pay(params) {
      const key = params.idempotencyKey;
      if (!key) {
        // No idempotency possible without a stable key — pass straight through.
        return port.pay(params);
      }

      // The whole claim→pay→complete path is serialized per store so that N
      // concurrent same-key callers resolve consistently: the winner pays, and
      // every loser replays the completed outcome rather than racing the
      // in-flight window.
      return withPaymentLock(store, async () => {
        const claimKey = keyFor(key);

        // Atomic claim: exactly one caller wins `pending`; concurrent duplicates
        // either replay a completed outcome or get PAYMENT_STATE_UNKNOWN.
        const claim = await store.conditionalUpdate<PurchasePaymentClaimRecord>(
          claimKey,
          (current) => {
            if (current === null || current === undefined) {
              return { next: { phase: 'pending', claimedAt: Date.now() } };
            }
            return { abort: 'already-claimed' };
          },
        );

        if (!claim.applied) {
          const existing = await store.get<PurchasePaymentClaimRecord>(claimKey);
          if (existing && existing.phase === 'completed') {
            return existing.result;
          }
          return {
            ok: false,
            errorCode: 'PAYMENT_STATE_UNKNOWN',
            error: `payment for idempotency key '${key}' is already in flight`,
          };
        }

        let result: EdgeOperationResult<PaymentResult>;
        try {
          result = await port.pay(params);
        } catch (err) {
          result = {
            ok: false,
            errorCode: 'PAYMENT_STATE_UNKNOWN',
            error: `payment port threw: ${(err as Error).message}`,
          };
        }

        // Record the outcome only if we still own the pending claim.
        await store.conditionalUpdate<PurchasePaymentClaimRecord>(
          claimKey,
          (current) => {
            if (current !== null && current !== undefined && current.phase === 'pending') {
              return {
                next: { phase: 'completed', result, completedAt: Date.now() },
              };
            }
            return { abort: 'gone' };
          },
        );

        return result;
      });
    },
  };
}