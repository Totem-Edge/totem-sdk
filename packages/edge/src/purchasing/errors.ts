/**
 * purchasing/errors.ts — Typed errors for the purchasing module.
 */

export class PurchaseError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PurchaseError';
    this.code = code;
  }
}

export class NegotiationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'NegotiationError';
    this.code = code;
  }
}

/** Error codes for the purchasing module. */
export const PURCHASE_ERROR_CODES = {
  STALE_REVISION: 'STALE_REVISION',
  TERMINAL_NEGOTIATION: 'TERMINAL_NEGOTIATION',
  REPLAYED_MESSAGE: 'REPLAYED_MESSAGE',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  WRONG_RECIPIENT: 'WRONG_RECIPIENT',
  STALE_PROPOSAL: 'STALE_PROPOSAL',
  WRONG_HEAD: 'WRONG_HEAD',
  CHALLENGE_ALREADY_CONSUMED: 'CHALLENGE_ALREADY_CONSUMED',
  WORK_BUDGET_EXHAUSTED: 'WORK_BUDGET_EXHAUSTED',
  NEGOTIATION_EXPIRED: 'NEGOTIATION_EXPIRED',
  PURCHASE_DEADLINE_EXPIRED: 'PURCHASE_DEADLINE_EXPIRED',
  PAYMENT_STATE_UNKNOWN: 'PAYMENT_STATE_UNKNOWN',
  RESOURCE_RECOVERY_REQUIRED: 'RESOURCE_RECOVERY_REQUIRED',
  TRANSPORT_UNAVAILABLE: 'TRANSPORT_UNAVAILABLE',
} as const;

export type PurchaseErrorCode = (typeof PURCHASE_ERROR_CODES)[keyof typeof PURCHASE_ERROR_CODES];
