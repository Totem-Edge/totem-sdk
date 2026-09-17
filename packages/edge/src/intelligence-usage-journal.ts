/**
 * @module @totemsdk/edge/intelligence-usage-journal
 *
 * Provider-neutral accounting wrapper around an {@link EdgeIntelligencePort}.
 *
 * Phase 3a (RFC-007 §4.2 / §3.5): Totem-owned inference usage/execution
 * records are written to an append-only, restart-recoverable `Journal`, and
 * the journal is the *audit trail* — never a competing counter. The owning
 * domain accounting authority (e.g. agent-policy's `GrantUsageStore`) remains
 * the authority; the journal is reconciled against it, not the reverse.
 *
 * Every dispatched inference call is journaled across two append-only events
 * joined by a caller-supplied or generated `requestId`:
 *
 *   started   → dispatched to the provider
 *   finished  → outcome `completed`, `failed`, or `outcome-unknown`
 *
 * `outcome-unknown` is written when the provider call throws (network drop,
 * provider death, cancellation racing the dispatch): the caller cannot know
 * whether the provider executed work, so the journal refuses to guess. On
 * restart the host replays `started`-without-`finished` via
 * {@link recoverInferenceJournal} as *interrupted* — it is never re-run and
 * never receipted. Receipts are a separate concern (see RFC-007 §3.5
 * "verification levels"): this wrapper never fabricates one.
 */

import { randomUUID } from 'crypto';
import type { EdgeIntelligencePort } from '@totemsdk/intelligence';
import { StorageError } from '@totemsdk/storage';
import type { Journal, JournalEntry } from '@totemsdk/storage/journal';

/**
 * Journaled inference usage/execution event.
 *
 * Two events per dispatched call, joined by `requestId`. The journal is
 * append-only: outcomes are never mutated in place, a `finished` event is
 * appended when the outcome is known (or deliberately recorded unknown).
 */
export type InferenceAuditEvent =
  | {
      readonly event: 'started';
      readonly requestId: string;
      readonly workflow: { readonly domain: string; readonly op: string };
      readonly providerId: string;
      readonly runId?: string;
      readonly proposalId?: string;
      readonly principal?: string;
      readonly agentId?: string;
      readonly startedAt: number;
      /** Verbatim invocation context (governance linkage for reconciliation). */
      readonly context?: Record<string, unknown>;
    }
  | {
      readonly event: 'finished';
      readonly requestId: string;
      readonly outcome: 'completed' | 'failed' | 'outcome-unknown';
      readonly finishedAt: number;
      readonly errorCode?: string;
      readonly errorMessage?: string;
      readonly usage?: InferenceRecordedUsage;
      /** Verbatim invocation context, mirrored from the paired `started` event. */
      readonly context?: Record<string, unknown>;
    };

/** JSON-clean usage measurements copied from the provider result. */
export interface InferenceRecordedUsage {
  readonly tokensIn?: number;
  readonly tokensOut?: number;
  readonly durationMs?: number;
  readonly metadata?: Record<string, number | string>;
}

export type InferenceReadEvent = JournalEntry<InferenceAuditEvent>;

/** Recovery view of the journal (Phase 3a accounting-recovery gate). */
export interface InferenceRecoveryReport {
  /**
   * `started` events with no `finished` — the process died (or the journal
   * was written for a call that never dispatched anything else). These are
   * *interrupted*: never re-run, never receipted, budget held.
   */
  readonly interrupted: ReadonlyArray<InferenceReadEvent>;
  /** `finished` events whose outcome is definitively `completed`. */
  readonly completed: ReadonlyArray<InferenceReadEvent>;
}

export interface CreateAccountedIntelligencePortOptions {
  /** Underlying provider-neutral port. */
  port: EdgeIntelligencePort;
  /** Append-only accounting journal (durably-acknowledged in production). */
  journal: Journal<InferenceAuditEvent>;
  /** Injectable clock (defaults to Date.now). */
  now?: () => number;
  /** Request-id generator used when the caller omits one (defaults to UUID). */
  requestId?: () => string;
}

/**
 * Bind an {@link EdgeIntelligencePort} and a {@link Journal} into an
 * accounted port. The wrapper is provider-neutral — it only ever sees
 * `EdgeIntelligencePort`'s provider-agnostic surface.
 *
 * Guarantees:
 * - A `started` event exists iff the provider was actually dispatched to
 *   (a pre-aborted signal short-circuits to `CANCELLED` with no journal write).
 * - Every dispatched call is closed by a `finished` event; a thrown provider
 *   call is closed as `outcome-unknown` and rethrown (behavior unchanged).
 * - No receipt is ever fabricated here.
 */
export function createAccountedIntelligencePort(
  options: CreateAccountedIntelligencePortOptions,
): EdgeIntelligencePort {
  const { port, journal } = options;
  const now = options.now ?? (() => Date.now());
  const requestIdGen = options.requestId ?? (() => randomUUID());

  async function recordFinished(
    record: Omit<Extract<InferenceAuditEvent, { event: 'finished' }>, 'finishedAt'>,
  ) {
    await journal.append({ ...record, finishedAt: now() });
  }

  return {
    providerId: port.providerId,
    capabilities: port.capabilities,

    async invoke(params) {
      // Mirror the underlying port's pre-dispatch abort check, before any
      // journal write: an already-aborted signal means nothing was dispatched.
      const signal = params.signal;
      if (signal?.aborted) {
        return { ok: false, errorCode: 'CANCELLED', error: 'Operation cancelled.' };
      }

      const requestId = params.requestId ?? requestIdGen();
      await journal.append({
        event: 'started',
        requestId,
        workflow: { domain: params.domain, op: params.op },
        providerId: port.providerId,
        runId: params.context?.runId as string | undefined,
        proposalId: params.context?.proposalId as string | undefined,
        principal: params.context?.principal as string | undefined,
        agentId: params.context?.agentId as string | undefined,
        context: params.context,
        startedAt: now(),
      });

      try {
        const result = await port.invoke({ ...params, requestId });

        if (result.ok) {
          const usage = (result.data?.usage ?? undefined) as Partial<InferenceRecordedUsage> | undefined;
          await recordFinished({
            event: 'finished',
            requestId,
            outcome: 'completed',
            context: params.context,
            usage: usage
              ? {
                  tokensIn: usage.tokensIn as number | undefined,
                  tokensOut: usage.tokensOut as number | undefined,
                  durationMs: usage.durationMs as number | undefined,
                  metadata: usage.metadata,
                }
              : undefined,
          });
          return result;
        }

        await recordFinished({
          event: 'finished',
          requestId,
          outcome: 'failed',
          context: params.context,
          errorCode: result.errorCode,
          errorMessage: result.error,
        });
        return result;
      } catch (error) {
        await recordFinished({
          event: 'finished',
          requestId,
          outcome: 'outcome-unknown',
          context: params.context,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },

    async cancel(requestId): Promise<{ ok: boolean; error?: string; errorCode?: string }> {
      if (!port.cancel) {
        return { ok: false, errorCode: 'NOT_IMPLEMENTED', error: 'Provider does not support cancel.' };
      }
      return port.cancel(requestId);
    },

    async close() {
      if (!port.close) return;
      await port.close();
    },
  };
}

/**
 * The accounting-recovery view over an inference journal.
 *
 * Walks the whole journal (strict: any corruption — a hole, a duplicate
 * start/finish for one requestId, a `finished` with no matching `started` —
 * surfaces rather than being treated as absence, matching RFC-007 §4.2).
 * Returns:
 *
 * - `interrupted`: `started` without `finished` → **outcome-unknown**.
 *   The host must hold budget for these and must never re-run the call or
 *   issue a receipt (RFC-007 §3.5).
 * - `completed`: definitively completed `finished` events, available for
 *   reconciliation against the owning domain authority.
 *
 * Performs zero provider interaction.
 */
export async function recoverInferenceJournal(
  journal: Journal<InferenceAuditEvent>,
): Promise<InferenceRecoveryReport> {
  const entries = await journal.read();

  const starts = new Map<string, InferenceReadEvent>();
  const finishes = new Map<string, InferenceReadEvent>();

  for (const entry of entries) {
    const requestId = entry.record.requestId;
    if (entry.record.event === 'started') {
      if (starts.has(requestId)) {
        throw new StorageError(
          `inference journal corrupt: duplicate started event for requestId ${requestId}`,
          'corrupt',
        );
      }
      starts.set(requestId, entry);
    } else {
      if (finishes.has(requestId)) {
        throw new StorageError(
          `inference journal corrupt: duplicate finished event for requestId ${requestId}`,
          'corrupt',
        );
      }
      finishes.set(requestId, entry);
    }
  }

  for (const [requestId, finish] of finishes) {
    if (!starts.has(requestId)) {
      throw new StorageError(
        `inference journal corrupt: finished event for unknown requestId ${requestId}`,
        'corrupt',
      );
    }
  }

  const interrupted: InferenceReadEvent[] = [];
  for (const [requestId, start] of starts) {
    if (!finishes.has(requestId)) {
      interrupted.push(start);
    }
  }

  const completed = entries.filter(
    (entry): entry is InferenceReadEvent => entry.record.event === 'finished' && entry.record.outcome === 'completed',
  );

  return { interrupted, completed };
}