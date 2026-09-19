/**
 * @module @totemsdk/edge/commerce-accounting
 *
 * Phase 3a accounting fold (RFC-007 §4.2 / OQ8): the commerce replay/outbox
 * is the owning domain accounting authority for purchase accounting, and the
 * inference usage journal is the audit trail reconciled to it — never a
 * competing counter.
 *
 * The fold is the reconciliation step for purchase-bound inference:
 *
 *   completed dispatch (journal: finished/`completed` + agreement context)
 *     → issue a signed UsageStatement
 *     → enqueue it into the durable purchasing outbox
 *
 * Hard rules (tied to the accounting-recovery gate):
 *   - Only `completed` runs fold. An *interrupted* run (`started` without
 *     `finished`) is recovered as interrupted and is NEVER billed and NEVER
 *     receives a statement.
 *   - `failed` and `outcome-unknown` runs never fold.
 *   - Non-purchase-bound dispatches (no agreement context) never fold.
 *   - Folding is idempotent: the statement's messageId is deterministic over
 *     its signed content, so a re-fold after restart enqueues the SAME entry
 *     (the outbox is keyed by messageId); the seller reconciles exactly once
 *     per statementId via its replay ledger + statement log.
 *
 * Honesty contract (§3.5): a statement is an accounting fold, not a receipt
 * and not a claim of verified work.
 */

import type { Journal } from '@totemsdk/storage/journal';
import {
  recoverInferenceJournal,
  type InferenceAuditEvent,
  type InferenceRecordedUsage,
} from './intelligence-usage-journal.js';
import { messageId } from './purchasing/messages.js';
import type { OutboxStore } from './purchasing/outbox.js';
import type { Signer } from './purchasing/seller.js';
import { usageStatementDigest } from './purchasing/terms.js';
import { PURCHASING_VERSION, type UsageStatement } from './purchasing/types.js';

/** Dispatcher-side view of the inference invocation that completed. */
export interface UsageFoldContext {
  requestId: string;
  context: Record<string, unknown> | undefined;
  usage: InferenceRecordedUsage | undefined;
}

/** Approval:// billing reference resolved for a purchase-bound dispatch. */
export interface UsageAgreementReference {
  agreementId: string;
  /** The principal being billed (the seller). */
  seller: string;
  negotiationId?: string;
  manifestId: string;
}

/**
 * Resolve the agreement a completed dispatch bills against. Return undefined
 * when the dispatch is not purchase-bound or the agreement cannot be found
 * (the fold skips it — nothing is billed by guessing).
 */
export type UsageAgreementResolver = (
  input: UsageFoldContext,
) => Promise<UsageAgreementReference | undefined> | UsageAgreementReference | undefined;

export interface IssueUsageStatementOptions {
  /** The issuer (buyer principal) whose signature binds the statement. */
  principal: string;
  agreement: UsageAgreementReference;
  requestId: string;
  usage?: InferenceRecordedUsage;
  /** Signature creation (WOTS). */
  signer: Signer;
  /** Injectable clock (defaults to Date.now). */
  now?: () => number;
}

/**
 * Build and sign a bounded usage statement for one completed dispatch.
 *
 * `statementId` is deterministic over the request: `${agreementId}:${requestId}:usage`.
 * Idempotency follows from the deterministic messageId over the signed payload.
 */
export async function issueUsageStatement(
  opts: IssueUsageStatementOptions,
): Promise<UsageStatement> {
  const issuedAt = opts.now?.() ?? Date.now();
  const unsigned = {
    version: PURCHASING_VERSION,
    statementId: usageStatementId(opts.agreement.agreementId, opts.requestId),
    agreementId: opts.agreement.agreementId,
    negotiationId: opts.agreement.negotiationId,
    manifestId: opts.agreement.manifestId,
    issuer: opts.principal,
    recipient: opts.agreement.seller,
    requestId: opts.requestId,
    usage: opts.usage ?? {},
    issuedAt,
  };
  const digest = usageStatementDigest(unsigned);
  const sig = await opts.signer(digest);
  return { ...unsigned, signature: sig.signature, signerPublicKey: sig.signerPublicKey };
}

/** Stable canonical statement identity for a completed dispatch. */
export function usageStatementId(agreementId: string, requestId: string): string {
  return `${agreementId}:${requestId}:usage`;
}

export interface FoldUsageStatementsInput {
  /** The inference usage journal (recovered for accounting). */
  journal: Journal<InferenceAuditEvent>;
  /** The durable purchasing outbox (the commerce accounting authority). */
  outbox: OutboxStore;
  /** The buyer's signature creation. */
  signer: Signer;
  /** The buyer principal issuing statements. */
  principal: string;
  /** Resolve a completed dispatch to the agreement it bills against. */
  resolveAgreement: UsageAgreementResolver;
  /** Injectable clock. */
  now?: () => number;
}

export interface FoldUsageStatementsReport {
  /** Completed purchase-bound dispatches folded into the outbox. */
  folded: number;
  /** Recovered interrupted runs — never folded, never billed. */
  interrupted: number;
  /** Completed purchase-attributable dispatches with no resolvable agreement. */
  dropped: number;
  /** Completed dispatches with no purchase agreement context at all. */
  skippedNotPurchaseBound: number;
}

/**
 * Recover the journal and fold every completed purchase-bound dispatch into
 * the purchasing outbox as a signed usage statement.
 *
 * This is the authoritative reconciliation pass: it is also safe to run after
 * a crash that interrupted a dispatch or the previous fold attempt — entries
 * already enqueued re-enqueue the SAME messageId (no duplication), and
 * `interrupted` runs are never billed.
 */
export async function foldUsageStatements(
  input: FoldUsageStatementsInput,
): Promise<FoldUsageStatementsReport> {
  const { journal, resolveAgreement } = input;
  const recovery = await recoverInferenceJournal(journal);

  let folded = 0;
  let dropped = 0;
  let skippedNotPurchaseBound = 0;

  for (const completed of recovery.completed) {
    const record = completed.record;
    if (record.event !== 'finished' || record.outcome !== 'completed') continue;
    if (!isPurchaseBound(record.context)) {
      skippedNotPurchaseBound += 1;
      continue;
    }
    const reference = await resolveAgreement({
      requestId: record.requestId,
      context: record.context,
      usage: record.usage,
    });
    if (!reference) {
      dropped += 1;
      continue;
    }
    await foldOne(input.outbox, input.now, input.principal, input.signer, record.requestId, record.usage, reference);
    folded += 1;
  }

  return {
    folded,
    interrupted: recovery.interrupted.length,
    dropped,
    skippedNotPurchaseBound,
  };
}

/** True when the mirrored invocation context names a purchase agreement. */
export function isPurchaseBound(context: Record<string, unknown> | undefined): boolean {
  if (!context) return false;
  return context.agreementId !== undefined || context.proposalId !== undefined;
}

async function foldOne(
  outbox: OutboxStore,
  now: (() => number) | undefined,
  principal: string,
  signer: Signer,
  requestId: string,
  usage: InferenceRecordedUsage | undefined,
  agreement: UsageAgreementReference,
): Promise<void> {
  const statement = await issueUsageStatement({
    principal,
    agreement,
    requestId,
    usage,
    signer,
    now,
  });
  await outbox.enqueue({
    messageId: messageId(statement),
    recipient: agreement.seller,
    message: statement,
    enqueuedAt: now?.() ?? Date.now(),
    attempts: 0,
  });
}

export interface FoldCompletedDispatchInput {
  /** The durable purchasing outbox (the commerce accounting authority). */
  outbox: OutboxStore;
  /** The buyer's signature creation. */
  signer: Signer;
  /** The buyer principal issuing the statement. */
  principal: string;
  requestId: string;
  context: Record<string, unknown> | undefined;
  usage: InferenceRecordedUsage | undefined;
  /** Resolve the completed dispatch to its agreement (undefined = skip). */
  resolveAgreement: UsageAgreementResolver;
  /** Injectable clock. */
  now?: () => number;
}

/**
 * Fold a single completed dispatch (the live-completion path, used by the
 * accounted port's `afterCompleted` hook). Returns `{ folded: true }` when a
 * statement was enqueued, `{ folded: false }` when the dispatch is not
 * purchase-bound or the agreement cannot be resolved.
 */
export async function foldCompletedDispatch(
  input: FoldCompletedDispatchInput,
): Promise<{ folded: boolean }> {
  if (!isPurchaseBound(input.context)) return { folded: false };
  const reference = await input.resolveAgreement({
    requestId: input.requestId,
    context: input.context,
    usage: input.usage,
  });
  if (!reference) return { folded: false };
  await foldOne(
    input.outbox,
    input.now,
    input.principal,
    input.signer,
    input.requestId,
    input.usage,
    reference,
  );
  return { folded: true };
}