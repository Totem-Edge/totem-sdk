/**
 * agent-policy/grant-bound.ts — Grant-bound autonomous step coordination.
 *
 * The runtime coordinator for existing bounded grants (`@totemsdk/authority`
 * signed mandates). An autonomous agent selects any next action that fits the
 * remaining mandate scope, constraints and usage budget; this layer evaluates
 * and reserves each step atomically, then commits or aborts on execution.
 *
 * `localBounds` are wallet safety rails that may tighten a mandate but never
 * broaden it. Portable authority remains in the signed mandate.
 */

import {
  computeActionIntentId,
  evaluateAuthority,
  snapshotFromUsage,
  type ActionIntent,
  type AuthorityDecision,
  type AuthorityIdentityResolver,
  type AuthorityUsageSnapshot,
  type MandateStatusSnapshot,
} from '@totemsdk/authority';
import type { SignedProof } from '@totemsdk/proof';
import type { AgentStep, AutonomousRun, StepAuthorization, StepReceipt } from './run.js';
import type { GrantUsageStore } from './grant-usage.js';

export interface GrantBoundPolicyOptions {
  /** Resolve a signed mandate proof by id. */
  mandateResolver: (mandateId: string) => Promise<SignedProof | undefined>;
  identityResolver: AuthorityIdentityResolver;
  /** Resolve current epoch / revocation state. */
  mandateStatusResolver?: () => Promise<MandateStatusSnapshot>;
  usageStore: GrantUsageStore;
  localBounds?: LocalBounds;
  /** Injectable clock (defaults to Date.now). */
  now?: () => number;
}

export interface LocalBounds {
  maxSteps?: number;
  maxParallelSteps?: number;
  maxRunDurationMs?: number;
  maxFailures?: number;
  requireMandateForEveryStep?: boolean;
  /** What to do when no mandate matches: 'requires_human' | 'rejected'. */
  unmatchedAction?: 'requires_human' | 'rejected';
}

export interface AuthorizeStepResult {
  allowed: boolean;
  reason?: string;
  decision?: AuthorityDecision;
  reservation?: StepAuthorization;
  matchedMandateId?: string;
}

/**
 * Resolve a trusted step field for mandate matching. Supports top-level step
 * fields (`runId`, `stepId`, `sequence`, `parentStepIds`, `workflow`, `target`)
 * and dotted paths into the action constraints (`payload.*`, `previousReceiptId`,
 * `cumulativeAmount`, `failureCount`).
 */
export function resolveStepField(step: AgentStep, field: string): unknown {
  switch (field) {
    case 'runId': return step.runId;
    case 'stepId': return step.stepId;
    case 'sequence': return step.sequence;
    case 'parentStepIds': return step.parentStepIds;
    case 'workflow': return step.action.constraints?.workflow;
    case 'target': return step.action.target;
    case 'action': return step.action.action;
    case 'principal': return step.action.principal;
    case 'agent': return step.action.agent;
    case 'nonce': return step.action.nonce;
    default: break;
  }

  const constraints = step.action.constraints;
  if (constraints === undefined) return undefined;
  if (Object.prototype.hasOwnProperty.call(constraints, field)) return constraints[field];
  if (field.includes('.')) {
    let current: unknown = constraints;
    for (const part of field.split('.')) {
      if (current === null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }
  return undefined;
}

export class GrantBoundPolicy {
  private readonly mandateResolver: (mandateId: string) => Promise<SignedProof | undefined>;
  private readonly identityResolver: AuthorityIdentityResolver;
  private readonly mandateStatusResolver?: () => Promise<MandateStatusSnapshot>;
  private readonly usageStore: GrantUsageStore;
  private readonly localBounds: Required<LocalBounds>;
  private readonly now: () => number;

  constructor(options: GrantBoundPolicyOptions) {
    this.mandateResolver = options.mandateResolver;
    this.identityResolver = options.identityResolver;
    this.mandateStatusResolver = options.mandateStatusResolver;
    this.usageStore = options.usageStore;
    this.now = options.now ?? (() => Date.now());
    this.localBounds = {
      maxSteps: options.localBounds?.maxSteps ?? 20,
      maxParallelSteps: options.localBounds?.maxParallelSteps ?? 2,
      maxRunDurationMs: options.localBounds?.maxRunDurationMs ?? 3_600_000,
      maxFailures: options.localBounds?.maxFailures ?? 3,
      requireMandateForEveryStep: options.localBounds?.requireMandateForEveryStep ?? true,
      unmatchedAction: options.localBounds?.unmatchedAction ?? 'requires_human',
    };
  }

  /**
   * Evaluate and reserve a step atomically:
   *  1. resolve applicable mandates;
   *  2. verify scope, constraints, expiry and revocation;
   *  3. check remaining count/amount/window budget;
   *  4. apply local bounds (tighten, never broaden);
   *  5. reserve mandate usage + local quotas atomically;
   *  6. return the full decision + reservation.
   */
  async authorizeStep(run: AutonomousRun, step: AgentStep, now = this.now()): Promise<AuthorizeStepResult> {
    const local = await this.checkLocalBounds(run, step, now);
    if (!local.allowed) {
      return { allowed: false, reason: local.reason };
    }

    const grantProofIds = run.grantProofIds;
    for (const mandateId of grantProofIds) {
      const mandate = await this.mandateResolver(mandateId);
      if (!mandate) continue;

      const mandateBody = mandate.payload?.mandate as { scope?: string; constraints?: unknown[]; usageLimit?: unknown } | undefined;
      if (!mandateBody) continue;

      const receipts = await this.usageStore.listCommittedReceipts(mandateId);
      const usageSnapshot = snapshotFromUsage(
        receipts.map((r) => ({
          usageId: r.reservationId,
          mandateProofId: r.mandateId,
          intentId: r.actionDigest,
          usedAt: r.committedAt,
          countsToward: { count: 1 },
        })),
        now,
        mandateBody.usageLimit as never,
      );

      const action: ActionIntent = {
        action: step.action.action,
        principal: step.action.principal,
        agent: step.action.agent,
        target: step.action.target,
        constraints: step.action.constraints,
        nonce: step.action.nonce,
      };

      const mandateStatus = this.mandateStatusResolver ? await this.mandateStatusResolver() : undefined;
      const { decision, usageDelta } = evaluateAuthority({
        action,
        mandate,
        identityResolver: this.identityResolver,
        usageSnapshot,
        mandateStatus,
        now,
      });

      if (!decision.allowed) continue;

      const actionDigest = computeActionIntentId(action);
      const reservation = await this.usageStore.authorizeAndReserve({
        runId: run.runId,
        stepId: step.stepId,
        mandateId,
        actionDigest,
        usageDelta,
        now,
      });

      return {
        allowed: true,
        decision,
        reservation,
        matchedMandateId: mandateId,
      };
    }

    // No mandate matched.
    if (this.localBounds.requireMandateForEveryStep) {
      return {
        allowed: false,
        reason: this.localBounds.unmatchedAction === 'requires_human'
          ? 'no matching mandate — requires human approval'
          : 'no matching mandate — rejected',
      };
    }
    return { allowed: true, reason: 'no mandate required (requireMandateForEveryStep=false)' };
  }

  async commitStep(reservationId: string, executionProof?: unknown): Promise<void> {
    const reservation = await this.usageStore.getReservation?.(reservationId);
    if (!reservation) throw new Error(`reservation ${reservationId} not found`);
    const receipt: StepReceipt = {
      reservationId,
      runId: reservation.runId,
      stepId: reservation.stepId,
      mandateId: reservation.mandateId,
      actionDigest: reservation.actionDigest,
      committedAt: this.now(),
      executionProof,
    };
    await this.usageStore.commit(reservationId, receipt);
  }

  async abortStep(reservationId: string, reason: string): Promise<void> {
    await this.usageStore.abort(reservationId, reason);
  }

  private async checkLocalBounds(
    run: AutonomousRun,
    step: AgentStep,
    now: number,
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (now - run.startedAt > this.localBounds.maxRunDurationMs) {
      return { allowed: false, reason: `run exceeds maxRunDurationMs (${this.localBounds.maxRunDurationMs})` };
    }

    const committed = await this.usageStore.countCommitted(run.runId);
    if (committed >= this.localBounds.maxSteps) {
      return { allowed: false, reason: `run exceeds maxSteps (${this.localBounds.maxSteps})` };
    }

    const reserved = await this.usageStore.countReserved(run.runId);
    if (reserved >= this.localBounds.maxParallelSteps) {
      return { allowed: false, reason: `run exceeds maxParallelSteps (${this.localBounds.maxParallelSteps})` };
    }

    const aborted = await this.usageStore.countAborted(run.runId);
    if (aborted >= this.localBounds.maxFailures) {
      return { allowed: false, reason: `run exceeds maxFailures (${this.localBounds.maxFailures})` };
    }

    return { allowed: true };
  }
}
