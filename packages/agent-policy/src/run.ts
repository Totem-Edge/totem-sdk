/**
 * agent-policy/run.ts — Autonomous run and step identity.
 *
 * A plan need not enumerate every step. An autonomous agent may select any
 * next action that fits the remaining mandate scope, constraints and usage
 * budget. Two modes:
 *
 *  - `dynamic`: choose steps at runtime within a reusable bounded mandate.
 *  - `plan_locked`: execute only steps committed by a plan digest or
 *    governance action mandates.
 */

import type { PaymentIntent } from './types.js';
import { sha3_256 } from '@noble/hashes/sha3.js';

export type RunMode = 'dynamic' | 'plan_locked';

/**
 * The security facts of an operation — derived from a PREPARED transaction or
 * simulation, never from agent-supplied hints. `PaymentIntent.amount` /
 * `recipient` / `risk` / `metadata` are explanatory hints, not security facts.
 */
export interface StepEffect {
  tokenId: string;
  amount: string;
  recipient?: string;
}

export interface ChannelEffect {
  channelId: string;
  operation: string;
}

export interface StepEffects {
  spends: StepEffect[];
  fees?: StepEffect[];
  channels?: ChannelEffect[];
  stateChanges?: Record<string, unknown>;
}

/**
 * Canonical action produced by the wallet from a prepared operation. The
 * authorization layer commits to these effects — not to an agent description.
 */
export interface CanonicalAgentAction extends ActionIntent {
  effects: StepEffects;
  runId: string;
  stepId: string;
  /** Optional: receipt ids of predecessor steps this step depends on. */
  parentReceiptIds?: string[];
}

/**
 * Autonomy profile modes:
 *  - `dynamic`: any step allowed by remaining grant authority.
 *  - `declared_plan`: steps may vary, but within a committed plan envelope.
 *  - `locked_plan`: exact DAG, actions and parameter ranges.
 *  - `single_step`: current behavior (one authorization, no run).
 */
export type AutonomyMode = 'dynamic' | 'declared_plan' | 'locked_plan' | 'single_step';

export interface RunLimits {
  maxSteps?: number;
  maxParallel?: number;
  maxFailures?: number;
  maxDurationMs?: number;
  /** Gross spend per run. `amount` is the ceiling in the token's native unit. */
  maxGrossSpend?: { tokenId: string; amount: string };
  /** Aggregate fee ceiling per run. */
  maxFees?: { tokenId: string; amount: string };
  maxOutstandingChannelExposure?: { tokenId: string; amount: string };
  /** Cap on gross spend across a single step. */
  maxStepSpend?: { tokenId: string; amount: string };
}

export interface StepTransitionRule {
  /** A step's action string. Wildcards allowed, e.g. `simulate`, `omnia:channel:pay:*`. */
  from: string;
  /** Actions that may follow `from`. */
  to: string[];
}

export interface RunObligations {
  quoteMaxAgeMs?: number;
  requireSimulation?: boolean;
  requireExecutionReceipt?: boolean;
  verifyPostconditions?: boolean;
}

export interface AutonomyProfile {
  profileId: string;
  mode: AutonomyMode;
  runLimits: RunLimits;
  transitions?: StepTransitionRule[];
  obligations?: RunObligations;
  boundaryFailure?: 'request_narrow_grant' | 'reject';
  /** grant-set composition, keyed by action string. */
  grantRequirements?: Record<string, GrantRequirement>;
}

export interface GrantRequirement {
  /** All of these grant ids must authorize (conjunction). */
  allOf?: string[];
  /** Any of these grant ids may authorize (disjunction). */
  anyOf?: string[];
}

const DOMAIN_CANONICAL_ACTION = 'TOTEM_AGENT_POLICY_CANONICAL_ACTION_V1';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'bigint') return JSON.stringify({ __bigint: value.toString() });
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  const object = value as Record<string, unknown>;
  return '{' + Object.keys(object).sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(',') + '}';
}

/**
 * Canonical digest of a prepared operation's SECURITY FACTS: the action, the
 * verified effects (spends/fees/channels/state), and the run+step binding.
 * Agent-supplied hints are excluded. A step that changes any effect or its
 * run/step identity is a different operation.
 */
export function canonicalAgentActionDigest(action: CanonicalAgentAction): string {
  const canonical = {
    action: action.action,
    principal: action.principal,
    agent: action.agent,
    target: action.target ?? null,
    nonce: action.nonce,
    effects: action.effects,
    runId: action.runId,
    stepId: action.stepId,
    parentReceiptIds: (action.parentReceiptIds ?? []).slice().sort(),
  };
  return toHex(sha3_256(new TextEncoder().encode(DOMAIN_CANONICAL_ACTION + canonicalJson(canonical))));
}

export interface AutonomousRun {
  runId: string;
  agentId: string;
  /** Authenticated principal (wallet-resolved signer / session), never agentId. */
  principal: string;
  startedAt: number;
  mode: RunMode;
  /** Signed mandate proof ids this run may draw from. */
  grantProofIds: string[];
  /** Plan digest, when plan_locked. */
  planDigest?: string;
}

export interface ActionIntent {
  action: string;
  principal: string;
  agent: string;
  target?: string;
  constraints?: Record<string, unknown>;
  nonce?: string;
}

export interface AgentStep {
  runId: string;
  stepId: string;
  sequence: number;
  parentStepIds?: string[];
  action: ActionIntent;
  evidenceIds?: string[];
  /** The intent that produced this step (kept for wallet execution). */
  intent?: PaymentIntent;
}

export interface StepAuthorizationInput {
  run: AutonomousRun;
  step: AgentStep;
  /** Signed mandate proof ids to consider (defaults to run.grantProofIds). */
  grantProofIds?: string[];
  now?: number;
}

export interface StepAuthorization {
  reservationId: string;
  decision: import('@totemsdk/authority').AuthorityDecision;
  usageDelta: { count: number; amount?: string };
  mandateId: string;
  runId: string;
  stepId: string;
  actionDigest: string;
  reservedAt: number;
  expiresAt: number;
}

export interface StepReceipt {
  reservationId: string;
  runId: string;
  stepId: string;
  mandateId: string;
  actionDigest: string;
  committedAt: number;
  executionProof?: unknown;
}
