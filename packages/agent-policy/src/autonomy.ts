/**
 * agent-policy/autonomy.ts — Run-level autonomy over existing mandates.
 *
 * Effective authority = signed mandate ∩ local autonomy profile ∩ verified
 * operation effects ∩ current run state.
 *
 * Profiles are LOCAL CEILINGS: they never grant authority themselves. Portable
 * authority remains in the signed mandate.
 */

import type {
  AutonomyProfile,
  CanonicalAgentAction,
  GrantRequirement,
  RunObligations,
  RunLimits,
  StepEffect,
  StepTransitionRule,
} from './run.js';

interface ProfileConfig {
  mode: 'dynamic' | 'declared_plan' | 'locked_plan';
  runLimits: RunLimits;
  transitions?: StepTransitionRule[];
  obligations?: RunObligations;
  boundaryFailure?: 'request_narrow_grant' | 'reject';
  grantRequirements?: Record<string, GrantRequirement>;
}

/** A boundary escalation that asks for a narrow, expiring, run-bound grant. */
export interface BoundaryEscalation {
  boundary: string;
  remaining: string;
  requested: string;
  suggestedGrant: {
    scope: string;
    maxTotal?: string;
    maxCount?: number;
    expiresInMs: number;
    bindToRunId: string;
  };
}

/** Structured boundary failure — never a bare boolean. */
export interface BoundaryFailure {
  kind: 'boundary_exceeded' | 'transition_invalid' | 'obligation_failed' | 'escalate';
  reason: string;
  boundary?: string;
  escalation?: BoundaryEscalation;
}

export interface AutonomyPolicy {
  profiles: Record<string, AutonomyProfile>;
}

/**
 * Define the local autonomy policy. Profiles are ceilings; they cannot broaden
 * a mandate.
 */
export function createAutonomyPolicy(config: { profiles: Record<string, ProfileConfig> }): AutonomyPolicy {
  const profiles: Record<string, AutonomyProfile> = {};
  for (const [id, p] of Object.entries(config.profiles)) {
    profiles[id] = {
      profileId: id,
      mode: p.mode,
      runLimits: p.runLimits,
      transitions: p.transitions,
      obligations: p.obligations,
      boundaryFailure: p.boundaryFailure ?? 'request_narrow_grant',
      grantRequirements: p.grantRequirements,
    };
  }
  return { profiles };
}

/**
 * Evaluate run limits for a prepared action's verified effects. All ceilings
 * are per-profile; a broader mandate is never needed.
 */
export function checkRunLimits(
  profile: AutonomyProfile,
  action: CanonicalAgentAction,
  state: {
    committedSteps: number;
    reservedSteps: number;
    abortedSteps: number;
    spentByToken: Record<string, string>;
    feesByToken: Record<string, string>;
    stepSpendByToken: Record<string, string>;
    outstandingByToken: Record<string, string>;
    now: number;
    startedAt: number;
  },
): BoundaryFailure | undefined {
  const L = profile.runLimits;

  if (L.maxSteps !== undefined && state.committedSteps + state.reservedSteps >= L.maxSteps) {
    return { kind: 'boundary_exceeded', reason: 'maxSteps', boundary: 'run.maxSteps' };
  }
  if (L.maxParallel !== undefined && state.reservedSteps >= L.maxParallel) {
    return { kind: 'boundary_exceeded', reason: 'maxParallel', boundary: 'run.maxParallel' };
  }
  if (L.maxFailures !== undefined && state.abortedSteps >= L.maxFailures) {
    return { kind: 'boundary_exceeded', reason: 'maxFailures', boundary: 'run.maxFailures' };
  }
  if (L.maxDurationMs !== undefined && state.now - state.startedAt > L.maxDurationMs) {
    return { kind: 'boundary_exceeded', reason: 'maxDurationMs', boundary: 'run.maxDurationMs' };
  }

  for (const spend of action.effects.spends ?? []) {
    if (L.maxStepSpend && L.maxStepSpend.tokenId === spend.tokenId) {
      const cap = L.maxStepSpend.amount;
      if (gt(spend.amount, cap)) {
        return { kind: 'boundary_exceeded', reason: 'maxStepSpend', boundary: 'run.maxStepSpend' };
      }
    }
    if (L.maxGrossSpend && L.maxGrossSpend.tokenId === spend.tokenId) {
      const used = state.spentByToken[spend.tokenId] ?? '0';
      if (gt(add(used, spend.amount), L.maxGrossSpend.amount)) {
        return escalateGrossSpend(profile, spend, L.maxGrossSpend.amount, used, action.runId);
      }
    }
  }

  for (const fee of action.effects.fees ?? []) {
    if (L.maxFees && L.maxFees.tokenId === fee.tokenId) {
      const used = state.feesByToken[fee.tokenId] ?? '0';
      if (gt(add(used, fee.amount), L.maxFees.amount)) {
        return {
          kind: 'boundary_exceeded',
          reason: 'maxFees',
          boundary: 'run.maxFees',
          escalation: {
            boundary: 'run.maxFees',
            remaining: sub(L.maxFees.amount, used),
            requested: fee.amount,
            suggestedGrant: {
              scope: action.action,
              maxTotal: sub(L.maxFees.amount, used),
              expiresInMs: 300_000,
              bindToRunId: action.runId,
            },
          },
        };
      }
    }
  }

  for (const ch of action.effects.channels ?? []) {
    if (L.maxOutstandingChannelExposure) {
      const used = state.outstandingByToken[ch.channelId] ?? '0';
      const total = add(used, '0');
      if (gt(total, L.maxOutstandingChannelExposure.amount)) {
        return { kind: 'boundary_exceeded', reason: 'maxOutstandingChannelExposure', boundary: 'run.maxOutstandingChannelExposure' };
      }
    }
  }

  return undefined;
}

function escalateGrossSpend(
  profile: AutonomyProfile,
  spend: StepEffect,
  cap: string,
  used: string,
  runId: string,
): BoundaryFailure {
  const remaining = sub(cap, used);
  return {
    kind: 'escalate',
    reason: 'maxGrossSpend exceeded',
    boundary: 'run.maxGrossSpend',
    escalation: {
      boundary: 'run.maxGrossSpend',
      remaining,
      requested: spend.amount,
      suggestedGrant: {
        scope: spend.recipient ? `omnia:channel:pay:${spend.recipient}` : 'omnia:channel:pay',
        maxTotal: spend.amount,
        expiresInMs: 300_000,
        bindToRunId: runId,
      },
    },
  };
}

/**
 * Validate a step transition against the profile's allowed DAG. Returns
 * whether `toAction` may follow `fromAction` (undefined = start of run).
 */
export function checkTransition(
  profile: AutonomyProfile,
  fromAction: string | undefined,
  toAction: string,
): boolean {
  const rules = profile.transitions;
  if (!rules || rules.length === 0) return true;
  if (fromAction === undefined) return isStartEligible(profile, toAction);
  const rule = rules.find((r) => tokenMatches(fromAction, r.from));
  if (!rule) return false;
  return rule.to.some((t) => tokenMatches(toAction, t));
}

/** First-step eligibility: a rule whose `from` is 'start' lists starting actions. */
export function isStartEligible(profile: AutonomyProfile, action: string): boolean {
  const rules = profile.transitions;
  if (!rules || rules.length === 0) return true;
  return rules.some((r) => r.from === 'start' && r.to.some((t) => tokenMatches(action, t)));
}

/** Validate obligations for a step (quoting freshness, simulation, execution, postconditions). */
export function checkObligations(
  obligations: RunObligations | undefined,
  action: CanonicalAgentAction,
  evidence: { simulation?: unknown; quoteTimestamp?: number; executionReceipt?: unknown; postconditionsVerified?: boolean },
  now: number,
): { ok: boolean; reason?: string } {
  if (!obligations) return { ok: true };

  if (obligations.quoteMaxAgeMs !== undefined && evidence.quoteTimestamp !== undefined) {
    if (now - evidence.quoteTimestamp > obligations.quoteMaxAgeMs) {
      return { ok: false, reason: 'quote is stale' };
    }
  }

  if (obligations.requireSimulation && !evidence.simulation) {
    return { ok: false, reason: 'simulation required' };
  }
  if (obligations.requireExecutionReceipt && !evidence.executionReceipt) {
    return { ok: false, reason: 'execution receipt required' };
  }
  if (obligations.verifyPostconditions && evidence.postconditionsVerified !== true) {
    return { ok: false, reason: 'postconditions not verified' };
  }
  return { ok: true };
}

/**
 * Evaluate a grant requirement (allOf / anyOf) against the set of grant ids
 * that authorized. Explicit semantics — never "whichever approves first".
 */
export function evaluateGrantRequirement(
  requirement: GrantRequirement | undefined,
  authorizedGrantIds: string[],
): boolean {
  if (!requirement) return true;
  const authorized = new Set(authorizedGrantIds);

  const allOf = requirement.allOf ?? [];
  const anyOf = requirement.anyOf ?? [];

  if (allOf.length > 0 && !allOf.every((g) => authorized.has(g))) return false;
  if (anyOf.length > 0 && !anyOf.some((g) => authorized.has(g))) return false;
  return true;
}

function tokenMatches(action: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern.endsWith(':*')) return action.startsWith(pattern.slice(0, -1));
  return action === pattern;
}

const DECIMAL = /^[0-9]+(?:\.[0-9]+)?$/;
const SCALE = 100_000_000n;

/** Exact scaled bigint of an amount string (whole or fractional). */
function toScaled(v: string): bigint {
  if (!DECIMAL.test(v)) return 0n;
  const [whole, frac] = v.split('.');
  const fracPadded = (frac ?? '').padEnd(8, '0').slice(0, 8);
  return BigInt(whole) * SCALE + BigInt(fracPadded || '0');
}

/** Render a scaled bigint back to a decimal string. */
function fromScaled(n: bigint): string {
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const whole = abs / SCALE;
  const frac = (abs % SCALE).toString().padStart(8, '0');
  const trimmed = (whole.toString() + '.' + frac).replace(/\.?0+$/, '');
  return (neg ? '-' : '') + (trimmed === '' ? '0' : trimmed);
}

function gt(a: string, b: string): boolean {
  return toScaled(a) > toScaled(b);
}
function add(a: string, b: string): string {
  return fromScaled(toScaled(a) + toScaled(b));
}
function sub(a: string, b: string): string {
  return fromScaled(toScaled(a) - toScaled(b));
}
