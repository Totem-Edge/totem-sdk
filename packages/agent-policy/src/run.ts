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

export type RunMode = 'dynamic' | 'plan_locked';

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
