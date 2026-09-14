/**
 * @module @totemsdk/intelligence/errors
 *
 * Provider-neutral error model. `IntelligenceError` carries an error code and
 * a retryable flag so consumers can route retries, budgets, and policies
 * without depending on any concrete provider's error vocabulary.
 */

/**
 * Error codes shared across intelligence providers.
 */
export type IntelligenceErrorCode =
  | 'NOT_IMPLEMENTED'
  | 'NOT_LOADED'
  | 'NOT_FOUND'
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'INVALID_REQUEST'
  | 'CONTEXT_OVERFLOW'
  | 'POLICY_REJECTED'
  | 'BUDGET_EXCEEDED'
  | 'INTERNAL';

/** Human-readable descriptions for each error code. */
export const INTELLIGENCE_ERROR_MESSAGES: Record<IntelligenceErrorCode, string> = {
  NOT_IMPLEMENTED: 'The requested operation is not implemented by this provider.',
  NOT_LOADED: 'The requested model is not loaded.',
  NOT_FOUND: 'The requested model, asset, or workspace was not found.',
  UNAVAILABLE: 'The provider is temporarily unavailable.',
  TIMEOUT: 'The operation timed out.',
  CANCELLED: 'The operation was cancelled.',
  INVALID_REQUEST: 'The request was malformed or missing required parameters.',
  CONTEXT_OVERFLOW: 'The input exceeded the model context window.',
  POLICY_REJECTED: 'The request was rejected by a policy layer.',
  BUDGET_EXCEEDED: 'The request exceeded an inference budget limit.',
  INTERNAL: 'An internal provider error occurred.',
};

/**
 * Base error for the intelligence surface.
 */
export class IntelligenceError extends Error {
  readonly code: IntelligenceErrorCode;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(code: IntelligenceErrorCode, message?: string, options?: {
    retryable?: boolean;
    details?: unknown;
    cause?: unknown;
  }) {
    super(message ?? INTELLIGENCE_ERROR_MESSAGES[code]);
    this.name = 'IntelligenceError';
    this.code = code;
    this.retryable = options?.retryable ?? (code === 'UNAVAILABLE' || code === 'TIMEOUT');
    this.details = options?.details;
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }

  static isIntelligenceError(err: unknown): err is IntelligenceError {
    return err instanceof IntelligenceError;
  }
}