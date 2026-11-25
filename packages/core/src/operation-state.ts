/**
 * Shared financial-operation lifecycle (OMN-073/074/076/077/084 and friends).
 *
 * The Omnia packages each invented a journal and a status vocabulary. The same
 * defect then appeared five times: a recovery record was cleared (or a result
 * reported) before the durable evidence it was supposed to protect existed, and
 * a failure whose outcome was actually unknown was recorded as retryable.
 *
 * This module is deliberately data and rules only — no orchestration, no
 * storage, no per-package modes. A package keeps its own journal type and uses
 * this vocabulary and table for the part that must mean the same thing
 * everywhere.
 */

export type OperationStatus =
  /** Accepted, not started. */
  | 'pending'
  /** Resources (keys, coins, capacity) are held but nothing has executed. */
  | 'reserved'
  /** Executing. A crash here leaves the outcome unknown. */
  | 'executing'
  /** Finished, and the result is durable. */
  | 'committed'
  /** Finished, and nothing happened. Safe to retry. */
  | 'failed'
  /**
   * Executed, but the outcome could not be established (crash, transport loss,
   * ambiguous error). Must be reconciled before anything is retried.
   */
  | 'unknown';

/** Statuses a caller must never treat as safe to re-run. */
export const TERMINAL_OPERATION_STATUSES: readonly OperationStatus[] = ['committed', 'unknown'];

const TRANSITIONS: Record<OperationStatus, readonly OperationStatus[]> = {
  // A one-shot operation may record a terminal state without an explicit
  // executing marker; that is still a real transition, not an ambiguous one.
  pending: ['reserved', 'executing', 'committed', 'failed', 'unknown'],
  reserved: ['executing', 'committed', 'failed', 'unknown'],
  executing: ['committed', 'failed', 'unknown'],
  // Only reconciliation moves an unknown outcome.
  unknown: ['committed', 'failed'],
  committed: [],
  failed: ['pending', 'executing'],
};

export function canTransitionOperation(from: OperationStatus, to: OperationStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminalOperationStatus(status: OperationStatus): boolean {
  return TERMINAL_OPERATION_STATUSES.includes(status);
}

export class OperationTransitionError extends Error {
  readonly from: OperationStatus;
  readonly to: OperationStatus;
  constructor(from: OperationStatus, to: OperationStatus, message?: string) {
    super(message ?? `Operation cannot move from ${from} to ${to}`);
    this.name = 'OperationTransitionError';
    this.from = from;
    this.to = to;
  }
}

export function assertOperationTransition(from: OperationStatus, to: OperationStatus): void {
  if (!canTransitionOperation(from, to)) {
    throw new OperationTransitionError(from, to);
  }
}
