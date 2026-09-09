/**
 * agent-policy/grant-bound-autonomy.ts — Run-level autonomy coordinator.
 *
 * Effective authority = signed mandate ∩ local autonomy profile ∩ verified
 * operation effects ∩ current run state.
 */

import { evaluateAuthority, snapshotFromUsage, type AuthorityIdentityResolver, type MandateStatusSnapshot } from '@totemsdk/authority';
import type { SignedProof } from '@totemsdk/proof';
import type { AutonomyProfile, CanonicalAgentAction, GrantRequirement, RunObligations, StepEffects } from './run.js';
import { checkObligations, checkRunLimits, checkTransition, evaluateGrantRequirement, type BoundaryFailure } from './autonomy.js';
import {
  MemoryRunStateStore,
  type RunReservation,
  type RunStateSnapshot,
  type RunStateStore,
  type RunStepReceipt,
} from './run-state-store.js';

export interface OpenRunParams {
  runId: string;
  agentId: string;
  principal: string;
  grantProofIds: string[];
  profileId: string;
  startedAt?: number;
  deadlineAt?: number;
}

export interface AuthorizeAndReserveParams {
  runId: string;
  stepId: string;
  /** Must be unique per run (anti-replay of a prepared step). */
  nonce: string;
  /** The PREPARED operation reduced to canonical security facts. */
  action: CanonicalAgentAction;
  evidence?: {
    simulation?: unknown;
    quoteTimestamp?: number;
    executionReceipt?: unknown;
    postconditionsVerified?: boolean;
  };
}

export interface RunAuthorization {
  outcome: 'approved';
  reservationId: string;
  actionDigest: string;
  decisionIds: string[];
  mandateIds: string[];
  usageDeltas: Array<{ mandateId: string; delta: { count: number; amount?: string } }>;
  reservedAt: number;
  expiresAt: number;
}

export interface SuggestedGrantAmendment {
  scope: string;
  maxTotal?: string;
  maxCount?: number;
  expiresInMs: number;
  bindToRunId: string;
}

export interface RunAuthorizationRejected {
  outcome: 'requires_human' | 'rejected';
  reason: string;
  boundaryError?: BoundaryFailure;
  suggestedGrant?: SuggestedGrantAmendment;
}

export type AuthorizeAndReserveResult = RunAuthorization | RunAuthorizationRejected;

export interface CommitParams {
  reservationId: string;
  executionProof?: unknown;
  /** The executor's re-snapshotted effects (default: the authorized action's effects). */
  effects?: StepEffects;
}

export interface RunReceiptGraph {
  runId: string;
  profileId: string;
  principal: string;
  agentId: string;
  startedAt: number;
  stepReceipts: RunStepReceipt[];
  totals: RunStateSnapshot['totals'];
}

export interface GrantBoundAutonomyOptions {
  autonomyProfiles: Record<string, AutonomyProfile>;
  mandateResolver: (mandateId: string) => Promise<SignedProof | undefined>;
  identityResolver: AuthorityIdentityResolver;
  /** Grant-set composition, keyed by action string. */
  grantRequirements?: Record<string, GrantRequirement>;
  mandateStatusResolver?: () => Promise<MandateStatusSnapshot>;
  stateStore?: RunStateStore;
  now?: () => number;
}

const DEFAULT_RESERVATION_TTL_MS = 60_000;

export class GrantBoundAutonomyPolicy {
  private readonly profiles: Record<string, AutonomyProfile>;
  private readonly mandateResolver: (id: string) => Promise<SignedProof | undefined>;
  private readonly identityResolver: AuthorityIdentityResolver;
  private readonly grantRequirements: Record<string, GrantRequirement>;
  private readonly mandateStatusResolver?: () => Promise<MandateStatusSnapshot>;
  private readonly stateStore: RunStateStore;
  private readonly now: () => number;

  constructor(options: GrantBoundAutonomyOptions) {
    this.profiles = options.autonomyProfiles;
    this.mandateResolver = options.mandateResolver;
    this.identityResolver = options.identityResolver;
    this.grantRequirements = options.grantRequirements ?? {};
    this.mandateStatusResolver = options.mandateStatusResolver;
    this.stateStore = options.stateStore ?? new MemoryRunStateStore();
    this.now = options.now ?? (() => Date.now());
  }

  async openRun(params: OpenRunParams): Promise<RunStateSnapshot> {
    const profile = this.profiles[params.profileId];
    if (!profile) throw new Error(`unknown autonomy profile '${params.profileId}'`);
    const snapshot: RunStateSnapshot = {
      runId: params.runId,
      profileId: params.profileId,
      principal: params.principal,
      agentId: params.agentId,
      grantProofIds: params.grantProofIds,
      startedAt: params.startedAt ?? this.now(),
      deadlineAt: params.deadlineAt,
      totals: {
        committedSteps: 0,
        reservedSteps: 0,
        abortedSteps: 0,
        spentByToken: {},
        feesByToken: {},
        outstandingByToken: {},
        usedNonces: [],
      },
    };
    await this.stateStore.createRun(snapshot);
    return snapshot;
  }

  async getRun(runId: string): Promise<RunStateSnapshot | undefined> {
    return this.stateStore.getRun(runId);
  }

  async authorizeAndReserve(params: AuthorizeAndReserveParams): Promise<AuthorizeAndReserveResult> {
    const run = await this.stateStore.getRun(params.runId);
    if (!run) return { outcome: 'rejected', reason: `run ${params.runId} not found` };
    const profile = this.profiles[run.profileId];
    if (!profile) return { outcome: 'rejected', reason: `profile ${run.profileId} not found` };

    const now = this.now();

    // 0. Nonce uniqueness (atomic).
    if (!(await this.stateStore.checkNonce(params.runId, params.nonce))) {
      return { outcome: 'rejected', reason: `nonce ${params.nonce} already used in run ${params.runId}` };
    }

    // 1. Transition within the profile DAG (using the last committed step's action).
    const receipts = await this.stateStore.listStepReceipts(params.runId);
    const lastCommitted = receipts[receipts.length - 1];
    const fromAction = lastCommitted ? (await this.lastActionOf(lastCommitted.reservationId)) : undefined;
    if (!checkTransition(profile, fromAction, params.action.action)) {
      return {
        outcome: 'rejected',
        reason: `action '${params.action.action}' is not a valid transition from '${fromAction ?? 'start'}' for profile '${run.profileId}'`,
      };
    }

    // 2. Obligations (simulation / quote freshness / execution receipt / postconditions).
    const obligations: RunObligations | undefined = profile.obligations;
    const obligationCheck = checkObligations(obligations, params.action, params.evidence ?? {}, now);
    if (!obligationCheck.ok) {
      return { outcome: 'rejected', reason: obligationCheck.reason ?? 'obligation failed' };
    }

    // 3. Run limits → escalate to a narrow-grant request when a ceiling is hit.
    const limitCheck = checkRunLimits(profile, params.action, {
      committedSteps: run.totals.committedSteps,
      reservedSteps: run.totals.reservedSteps,
      abortedSteps: run.totals.abortedSteps,
      spentByToken: run.totals.spentByToken,
      feesByToken: run.totals.feesByToken,
      stepSpendByToken: spentByTokenOf(params.action.effects.spends ?? []),
      outstandingByToken: run.totals.outstandingByToken,
      now,
      startedAt: run.startedAt,
    });
    if (limitCheck) {
      // The escalation must bind to the ACTUAL run — never to a caller-supplied
      // action.runId that could point elsewhere.
      if (limitCheck.escalation && profile.boundaryFailure === 'request_narrow_grant') {
        return {
          outcome: 'requires_human',
          reason: limitCheck.reason,
          boundaryError: limitCheck,
          suggestedGrant: {
            ...limitCheck.escalation.suggestedGrant,
            bindToRunId: run.runId,
          },
        };
      }
      return { outcome: 'rejected', reason: limitCheck.reason };
    }

    // 4. Grant-set composition (allOf/anyOf) with explicit semantics.
    const requirement = this.grantRequirements[params.action.action] ?? profile.grantRequirements?.[params.action.action];
    const authorizedGrantIds: string[] = [];
    const decisionIds: string[] = [];
    const usageDeltas: Array<{ mandateId: string; delta: { count: number; amount?: string } }> = [];

    for (const mandateId of run.grantProofIds) {
      const mandate = await this.mandateResolver(mandateId);
      if (!mandate) continue;
      const evalResult = await this.evaluateMandate(mandate, params.action, run, now);
      if (!evalResult) continue;
      authorizedGrantIds.push(mandateId);
      decisionIds.push(evalResult.decisionId);
      usageDeltas.push({ mandateId, delta: evalResult.usageDelta });
    }

    if (!evaluateGrantRequirement(requirement, authorizedGrantIds)) {
      const missing = (requirement?.allOf ?? []).filter((g) => !authorizedGrantIds.includes(g));
      return {
        outcome: 'requires_human',
        reason: `grant requirement not satisfied for '${params.action.action}' (missing: ${missing.join(', ') || 'no anyOf matched'})`,
      };
    }

    if (authorizedGrantIds.length === 0) {
      return { outcome: 'requires_human', reason: `no mandate authorized '${params.action.action}'` };
    }

    // 5. Reserve atomically: mandate usage + concurrency slot + nonce (already consumed).
    const reservedAt = now;
    const expiresAt = reservedAt + DEFAULT_RESERVATION_TTL_MS;
    const reservation: RunReservation = {
      reservationId: `res:${run.runId}:${params.stepId}:${reservedAt}`,
      runId: run.runId,
      stepId: params.stepId,
      stepAction: params.action.action,
      actionDigest: params.action.nonce ?? params.nonce,
      effects: params.action.effects,
      reservedAt,
      expiresAt,
      status: 'reserved',
      mandateIds: authorizedGrantIds,
      decisionIds,
    };
    await this.stateStore.reserveStep(reservation);

    return {
      outcome: 'approved',
      reservationId: reservation.reservationId,
      actionDigest: params.action.nonce ?? params.nonce,
      decisionIds,
      mandateIds: authorizedGrantIds,
      usageDeltas,
      reservedAt,
      expiresAt,
    };
  }

  async commit(params: CommitParams): Promise<RunStepReceipt> {
    const reservation = await this.stateStore.getReservation(params.reservationId);
    if (!reservation) throw new Error(`reservation ${params.reservationId} not found`);
    const receipt: RunStepReceipt = {
      reservationId: reservation.reservationId,
      runId: reservation.runId,
      stepId: reservation.stepId,
      actionDigest: reservation.actionDigest,
      committedAt: this.now(),
      executionProof: params.executionProof,
      mandateIds: reservation.mandateIds ?? [],
      decisionIds: reservation.decisionIds ?? [],
      effects: params.effects ?? reservation.effects,
    };
    await this.stateStore.commitStep(reservation.reservationId, receipt);
    return receipt;
  }

  async abort(reservationId: string, error: unknown): Promise<void> {
    await this.stateStore.abortStep(reservationId, error instanceof Error ? error.message : String(error));
  }

  async getRunReceiptGraph(runId: string): Promise<RunReceiptGraph | undefined> {
    const run = await this.stateStore.getRun(runId);
    if (!run) return undefined;
    return {
      runId: run.runId,
      profileId: run.profileId,
      principal: run.principal,
      agentId: run.agentId,
      startedAt: run.startedAt,
      stepReceipts: await this.stateStore.listStepReceipts(runId),
      totals: run.totals,
    };
  }

  private async lastActionOf(reservationId: string): Promise<string | undefined> {
    const reservation = await this.stateStore.getReservation(reservationId);
    return reservation?.stepAction;
  }

  private async evaluateMandate(
    mandate: SignedProof,
    action: CanonicalAgentAction,
    run: RunStateSnapshot,
    now: number,
  ): Promise<{ decisionId: string; usageDelta: { count: number; amount?: string } } | undefined> {
    const mandateBody = mandate.payload?.mandate as { scope?: string; constraints?: unknown[]; usageLimit?: unknown } | undefined;
    if (!mandateBody) return undefined;

    const mandateId = mandate.proofId;
    const receipts = await this.stateStore.listStepReceipts(run.runId);
    const mandateReceipts = receipts.filter((r) => r.mandateIds.includes(mandateId));
    const usageSnapshot = snapshotFromUsage(
      mandateReceipts.map((r, i) => ({
        usageId: `${r.reservationId}:${i}`,
        mandateProofId: mandateId,
        intentId: r.actionDigest,
        usedAt: r.committedAt,
        countsToward: { count: 1 },
      })),
      now,
      mandateBody.usageLimit as never,
    );

    const identityAction = {
      action: action.action,
      principal: run.principal,
      agent: action.agent,
      target: action.target,
      constraints: action.constraints,
      nonce: action.nonce,
    };
    const mandateStatus = this.mandateStatusResolver ? await this.mandateStatusResolver() : undefined;
    const { decision, usageDelta } = evaluateAuthority({
      action: identityAction,
      mandate,
      identityResolver: this.identityResolver,
      usageSnapshot,
      mandateStatus,
      now,
    });
    if (!decision.allowed) return undefined;
    return { decisionId: decision.decisionId, usageDelta };
  }
}

/** Token→amount accumulation (decimal-safe). */
const DECIMAL = /^[0-9]+(?:\.[0-9]+)?$/;
const SCALE = 100_000_000n;

function toScaled(v: string): bigint {
  if (!DECIMAL.test(v)) return 0n;
  const [whole, frac] = v.split('.');
  return BigInt(whole) * SCALE + BigInt((frac ?? '').padEnd(8, '0').slice(0, 8) || '0');
}

function fromScaled(n: bigint): string {
  const whole = n / SCALE;
  const frac = (n % SCALE).toString().padStart(8, '0');
  return (whole.toString() + '.' + frac).replace(/\.?0+$/, '') || '0';
}

export function accumulateAmount(a: string | undefined, b: string): string {
  return fromScaled(toScaled(a ?? '0') + toScaled(b));
}

function spentByTokenOf(spends: Array<{ tokenId: string; amount: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of spends) out[s.tokenId] = accumulateAmount(out[s.tokenId], s.amount);
  return out;
}
