/**
 * purchasing/purchase.ts — Durable purchase/session lifecycle record.
 *
 * Persists economically meaningful phases so a crash/restart can recover
 * exactly where a purchase left off. Every record carries a monotonically
 * increasing `revision` for atomic CAS transitions.
 */

import type { PurchaseIntent, TradeAgreement } from './types.js';

/** Purchase lifecycle phases. */
export type PurchaseStatus =
  | 'REQUESTED'
  | 'DISCOVERING'
  | 'NEGOTIATING'
  | 'AGREED'
  | 'AUTHORIZING'
  | 'AUTHORIZED'
  | 'PAYING'
  | 'PAID'
  | 'STARTING_RESOURCE'
  | 'ACTIVE'
  | 'SETTLING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

/** Terminal purchase statuses. */
export const TERMINAL_PURCHASE_STATUSES: ReadonlySet<PurchaseStatus> = new Set([
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

/**
 * A durable purchase record.
 *
 * `idempotencyKeys` records the stable operation identities already issued
 * (payment, resource-start, settlement, receipt) so retries never duplicate
 * side effects.
 */
export interface PurchaseRecord {
  purchaseId: string;
  intent: PurchaseIntent;
  status: PurchaseStatus;
  /** Absolute acquisition deadline (persisted, not a relative timer). */
  acquireBy?: number;
  agreement?: TradeAgreement;
  /** Stable idempotency keys already issued. */
  idempotencyKeys: string[];
  /** Resource handle reference (only if safe/meaningful to persist). */
  resourceReference?: string;
  /** Monotonically increasing revision for atomic CAS transitions. */
  revision: number;
  createdAt: number;
  updatedAt: number;
  /** Terminal reason (when terminal). */
  terminalReason?: string;
}

export function createPurchaseRecord(opts: {
  purchaseId: string;
  intent: PurchaseIntent;
  acquireBy?: number;
  createdAt?: number;
}): PurchaseRecord {
  const createdAt = opts.createdAt ?? Date.now();
  return {
    purchaseId: opts.purchaseId,
    intent: opts.intent,
    status: 'REQUESTED',
    acquireBy: opts.acquireBy,
    idempotencyKeys: [],
    revision: 1,
    createdAt,
    updatedAt: createdAt,
  };
}

/** Derive a stable idempotency key for a side-effecting operation. */
export function idempotencyKey(
  purchaseId: string,
  agreementId: string,
  operation: 'payment' | 'resource-start' | 'settlement' | 'receipt',
): string {
  return `${purchaseId}:${agreementId}:${operation}`;
}
