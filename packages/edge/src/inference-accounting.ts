/**
 * @module @totemsdk/edge/inference-accounting
 *
 * Reconcile the inference usage/execution journal against the owning domain
 * accounting authority (agent-policy's `GrantUsageStore`), per RFC-007 §3.5
 * "policy-accounted" verification level and §4.2 accounting-authority rule.
 *
 * The journal is the audit trail; `GrantUsageStore` is the counter. This
 * reconciliation is a read-only cross-check (`reconcileInferenceAccounting`)
 * that reports mismatches for the host to resolve — it never mutates the
 * store, so it can never double-count or compete as a second authority.
 */

import type { Journal, JournalEntry } from '@totemsdk/storage/journal';
import type { InferenceAuditEvent, InferenceReadEvent } from './intelligence-usage-journal.js';
import { recoverInferenceJournal } from './intelligence-usage-journal.js';

/** The minimal surface of the owning authority this reconciliation needs. */
export interface InferenceAccountingAuthority {
  /** Committed step receipts for a mandate — used to see what was accounted. */
  listCommittedReceipts(mandateId: string): Promise<readonly { runId: string; stepId: string }[]>;
}

export interface InferenceAccountingReconciliation {
  /** Completed journal entries with no matching committed receipt. */
  readonly completedUnaccounted: ReadonlyArray<InferenceReadEvent>;
  /**
   * Interrupted (outcome-unknown) entries that nevertheless have a committed
   * receipt — the serious case: work was charged for an execution whose
   * outcome is unknown. Surfaced, never silently accepted.
   */
  readonly interruptedAccounted: ReadonlyArray<InferenceReadEvent>;
  readonly completedCount: number;
  readonly accountedCount: number;
  readonly interruptedCount: number;
  readonly consistent: boolean;
}

export interface ReconcileInferenceAccountingOptions {
  journal: Journal<InferenceAuditEvent>;
  authority: InferenceAccountingAuthority;
  mandateId: string;
  /**
   * Map a journal event to the step a host tuned into `context.metadata`
   * at dispatch time. Defaults to reading `context.metadata.stepId`.
   */
  stepIdOf?: (entry: InferenceReadEvent) => string | undefined;
}

/**
 * Read-only cross-check between the inference journal and the owning
 * accounting authority for one mandate.
 *
 * Matches journal events to committed receipts by `(runId, stepId)`. A
 * completed entry with no committed receipt is `completedUnaccounted` (the
 * host should resolve — e.g. aborted prematurely or the account lags). An
 * interrupted entry that IS in the committed set is `interruptedAccounted`,
 * which must never be treated as a normal completion — the account has
 * consumption the journal cannot corroborate as `completed`. The caller
 * decides the corrective action; this function never writes.
 */
export async function reconcileInferenceAccounting(
  input: ReconcileInferenceAccountingOptions,
): Promise<InferenceAccountingReconciliation> {
  const { journal, authority, mandateId } = input;
  const stepIdOf = input.stepIdOf ?? defaultStepIdOf;

  const report = await recoverInferenceJournal(journal);
  const committed = new Set(
    (await authority.listCommittedReceipts(mandateId)).map((receipt) => `${receipt.runId}:${receipt.stepId}`),
  );

  const completedUnaccounted: InferenceReadEvent[] = [];
  let accountedCount = 0;

  for (const entry of report.completed) {
    const key = entryKeyOf(entry, stepIdOf);
    if (key !== undefined && committed.has(key)) {
      accountedCount += 1;
    } else {
      completedUnaccounted.push(entry);
    }
  }

  const interruptedAccounted: InferenceReadEvent[] = [];
  for (const entry of report.interrupted) {
    const key = entryKeyOf(entry, stepIdOf);
    if (key !== undefined && committed.has(key)) {
      interruptedAccounted.push(entry);
    }
  }

  return {
    completedUnaccounted,
    interruptedAccounted,
    completedCount: report.completed.length,
    accountedCount,
    interruptedCount: report.interrupted.length,
    consistent: accountedCount === report.completed.length && interruptedAccounted.length === 0,
  };
}

function entryKeyOf(
  entry: InferenceReadEvent,
  stepIdOf: (entry: InferenceReadEvent) => string | undefined,
): string | undefined {
  const runId = entry.record.context?.runId as string | undefined;
  const stepId = stepIdOf(entry);
  if (runId === undefined || stepId === undefined) return undefined;
  return `${runId}:${stepId}`;
}

function defaultStepIdOf(entry: InferenceReadEvent): string | undefined {
  const metadata = entry.record.context?.metadata as Record<string, unknown> | undefined;
  if (metadata === undefined) return undefined;
  const stepId = metadata.stepId;
  return typeof stepId === 'string' ? stepId : undefined;
}

export type { Journal, JournalEntry };