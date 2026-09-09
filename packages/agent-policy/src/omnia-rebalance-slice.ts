/**
 * agent-policy/omnia-rebalance-slice.ts — One complete autonomous Omnia
 * rebalance workflow, as the vertical slice for run-level autonomy.
 *
 * The wallet builds (or simulates) the Omnia transaction FIRST, then reduces it
 * to canonical security facts (spends/fees/channel effects). Agent-supplied
 * hints are never treated as security facts. The prepared operation is what the
 * autonomy policy authorizes.
 */

import type { CanonicalAgentAction, StepEffects } from './run.js';
import { accumulateAmount } from './grant-bound-autonomy.js';

export interface PreparedRebalanceOperation {
  poolId: string;
  positionId: string;
  fromAllocationId: string;
  toChannelId: string;
  /** Prepared by the wallet from the actual tx build/simulation. */
  spends: Array<{ tokenId: string; amount: string; recipient: string }>;
  fees: Array<{ tokenId: string; amount: string }>;
  /** The channel operation the rebalance performs. */
  channelOps: Array<{ channelId: string; operation: string }>;
  /** Quote/simulation evidence captured by the wallet. */
  simulation?: unknown;
  quoteTimestamp?: number;
  executionReceipt?: unknown;
  postconditionsVerified?: boolean;
}

export interface PreparedStep {
  stepId: string;
  action: string;
  nonce: string;
  operation: PreparedRebalanceOperation;
}

/**
 * Build a canonical action from a PREPARED operation. The wallet supplies the
 * effects; the autonomy policy authorizes exactly these.
 */
export function reduceToCanonicalAction(
  runId: string,
  principal: string,
  agentId: string,
  step: PreparedStep,
  evidence: { simulation?: unknown; quoteTimestamp?: number; executionReceipt?: unknown; postconditionsVerified?: boolean },
): CanonicalAgentAction {
  const effects: StepEffects = {
    spends: step.operation.spends,
    fees: step.operation.fees,
    channels: step.operation.channelOps,
    stateChanges: { positionId: step.operation.positionId },
  };
  return {
    action: step.action,
    principal,
    agent: agentId,
    target: step.operation.toChannelId,
    effects,
    runId,
    stepId: step.stepId,
    nonce: step.nonce,
    constraints: {
      poolId: step.operation.poolId,
      positionId: step.operation.positionId,
      fromAllocationId: step.operation.fromAllocationId,
      toChannelId: step.operation.toChannelId,
      simulation: evidence.simulation,
    },
  };
}

/**
 * Compose a run-level spend ceiling from the prepared operations actually
 * authorized/committed — used for the run receipt graph totals.
 */
export function summarizeStepSpend(effects: StepEffects): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of effects.spends ?? []) out[s.tokenId] = accumulateAmount(out[s.tokenId], s.amount);
  return out;
}
