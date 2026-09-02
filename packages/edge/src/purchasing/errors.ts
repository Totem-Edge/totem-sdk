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
