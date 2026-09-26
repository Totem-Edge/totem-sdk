/**
 * @module @totemsdk/decision/errors
 *
 * Provider-neutral decision error model. `DecisionError` carries a code and a
 * retryable flag so the runtime and callers can route escalation, budgets, and
 * policies without depending on any provider's error vocabulary.
 */

/**
 * Error codes shared across the decision surface.
 *
 * `NO_ACCEPTABLE_RESULT` is the terminal outcome when every route is skipped,
 * rejected, or fails.
 */
export type DecisionErrorCode =
  | 'NOT_IMPLEMENTED'
  | 'INVALID_REQUEST'
  | 'INVALID_OUTPUT'
  | 'INVALID_CANDIDATE'
  | 'DUPLICATE_CANDIDATE'
  | 'EMPTY_CANDIDATE_SET'
  | 'NON_FINITE_NUMBER'
  | 'INVALID_DISTRIBUTION'
  | 'LIMIT_EXCEEDED'
  | 'NO_ACCEPTABLE_RESULT'
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'PROVIDER_ERROR'
  | 'STALE_DECISION'
  | 'INTERNAL';

/** Human-readable descriptions for each error code. */
export const DECISION_ERROR_MESSAGES: Record<DecisionErrorCode, string> = {
  NOT_IMPLEMENTED: 'The requested decision semantic is not implemented by this provider.',
  INVALID_REQUEST: 'The decision request was malformed or missing required fields.',
  INVALID_OUTPUT: 'The provider output failed candidate-constrained validation.',
  INVALID_CANDIDATE: 'A candidate referenced an id outside the offered candidate set.',
  DUPLICATE_CANDIDATE: 'A candidate id was used more than once within its namespace.',
  EMPTY_CANDIDATE_SET: 'A decision question or action space offered no candidates.',
  NON_FINITE_NUMBER: 'A decision value contained NaN or an infinite number.',
  INVALID_DISTRIBUTION: 'A probability distribution failed validation.',
  LIMIT_EXCEEDED: 'The request exceeded a configured runtime or provider limit.',
  NO_ACCEPTABLE_RESULT: 'No route produced an acceptable decision result.',
  UNAVAILABLE: 'The decision provider is temporarily unavailable.',
  TIMEOUT: 'The decision provider timed out.',
  CANCELLED: 'The decision was cancelled.',
  PROVIDER_ERROR: 'The decision provider raised an unexpected error.',
  STALE_DECISION: 'The decision result is stale relative to the current request.',
  INTERNAL: 'An internal decision runtime error occurred.',
};

/**
 * Escalation reasons recorded on attempt provenance when a route does not
 * produce the accepted result.
 */
export type DecisionEscalationReason =
  | 'LOW_CONFIDENCE'
  | 'LOW_SELECTED_PROBABILITY'
  | 'INVALID_OUTPUT'
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'PROVIDER_ERROR'
  | 'LIMIT_EXCEEDED'
  | 'INELIGIBLE'
  | 'NOT_IMPLEMENTED'
  | 'CUSTOM_REJECTION';

/** Base error for the decision surface. */
export class DecisionError extends Error {
  readonly code: DecisionErrorCode;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(
    code: DecisionErrorCode,
    message?: string,
    options?: { retryable?: boolean; details?: unknown; cause?: unknown },
  ) {
    super(message ?? DECISION_ERROR_MESSAGES[code]);
    this.name = 'DecisionError';
    this.code = code;
    this.retryable =
      options?.retryable ?? (code === 'UNAVAILABLE' || code === 'TIMEOUT');
    this.details = options?.details;
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }

  static isDecisionError(err: unknown): err is DecisionError {
    return err instanceof DecisionError;
  }
}
