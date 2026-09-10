/**
 * omnia-pool/autonomous-rebalance.ts — Autonomous Omnia rebalance execution.
 *
 * The vertical slice that wires run-level autonomy into the real wallet
 * execution path:
 *
 *   prepare → reduce → authorize → execute → commit / abort
 *
 * The wallet builds the Omnia transaction FIRST (via `@totemsdk/omnia`'s
 * `buildUpdateTx` / `buildFundingTx`), then reduces it to canonical security
 * facts with `reduceToCanonicalAction`. `GrantBoundAutonomyPolicy` authorizes
 * exactly those effects — never an agent description. On approval the prepared
 * operation is executed against the live execution port and the reservation is
 * committed (or aborted on failure).
 *
 * The tx digest is derived from the canonical Minima bytes
 * (`computeOmniaTxDigest`), so the execution proof is bound to the exact
 * transaction that was authorized.
 */

import { bytesToHex } from '@totemsdk/core';
import {
  buildFundingTx,
  buildUpdateTx,
  computeOmniaTxDigest,
  type OmniaChannel,
  type OmniaTxDraft,
} from '@totemsdk/omnia';
import {
  GrantBoundAutonomyPolicy,
  reduceToCanonicalAction,
  type CanonicalAgentAction,
  type PreparedRebalanceOperation,
  type PreparedStep,
  type RunAuthorization,
  type RunAuthorizationRejected,
} from '@totemsdk/agent-policy';
import { rebalancePoolCapital } from './allocate.js';
import type { RebalanceAllocationParams } from './types.js';
import type { LiquidityAllocation, LiquidityBondRegistryState, LiquidityPosition } from '@totemsdk/liquidity-bond';
import type { OmniaPoolAllocationContext } from './types.js';

/** The channel state update a rebalance performs on a live channel. */
export interface RebalanceChannelUpdate {
  channel: OmniaChannel;
  newBalances: Record<string, bigint>;
  /** The channel operation string recorded in the canonical action. */
  operation: string;
}

/** A prepared rebalance step: the wallet-built tx draft + its canonical facts. */
export interface PreparedRebalanceStep {
  stepId: string;
  action: string;
  nonce: string;
  /** The Omnia tx draft the wallet built (or simulated). Optional for pure pool mutations. */
  draft?: OmniaTxDraft;
  /** The channel update the rebalance performs (for execution). */
  channelUpdate?: RebalanceChannelUpdate;
  /** The pool allocation mutation the rebalance performs. */
  allocation?: {
    params: RebalanceAllocationParams;
    position: LiquidityPosition;
    registry: LiquidityBondRegistryState;
  };
  /** Quote/simulation evidence captured by the wallet. */
  simulation?: unknown;
  quoteTimestamp?: number;
  executionReceipt?: unknown;
  postconditionsVerified?: boolean;
}

export interface AutonomousRebalanceOptions {
  policy: GrantBoundAutonomyPolicy;
  runId: string;
  principal: string;
  agentId: string;
  /** Execution port for live Omnia operations. */
  ctx?: OmniaPoolAllocationContext;
}

export interface AutonomousRebalanceResult {
  outcome: 'approved' | 'requires_human' | 'rejected';
  authorization?: RunAuthorization;
  rejection?: RunAuthorizationRejected;
  /** The canonical action that was authorized (for the receipt graph). */
  canonical?: CanonicalAgentAction;
  /** The tx digest the execution proof is bound to. */
  txDigest?: string;
  /** The executed channel update (when the step performed one). */
  channelUpdate?: RebalanceChannelUpdate;
  /** The executed pool allocation mutation. */
  allocation?: {
    released: LiquidityAllocation;
    newAllocation: LiquidityAllocation;
    position: LiquidityPosition;
    registry: LiquidityBondRegistryState;
  };
}

/**
 * Reduce a prepared rebalance step to a canonical action and authorize it.
 * The wallet's tx draft is the source of truth for spends/fees/channel effects.
 */
export function prepareRebalanceStep(
  runId: string,
  principal: string,
  agentId: string,
  step: PreparedRebalanceStep,
): { canonical: CanonicalAgentAction; prepared: PreparedStep } {
  const channelId = step.channelUpdate?.channel.channelId ?? '';
  const channelScriptAddress = step.channelUpdate?.channel.fundingAddress;
  // Security facts: only outputs that leave the channel's own script are spends.
  // A channel-internal rebalance (update tx) pays the full value back to the
  // channel script — that is a state change, not an external spend.
  const spends = (step.draft?.outputs ?? [])
    .filter((o) => o.address !== channelScriptAddress)
    .map((o) => ({
      tokenId: o.tokenId,
      amount: o.amount.toString(),
      recipient: o.address,
    }));
  const operation: PreparedRebalanceOperation = {
    poolId: step.allocation?.params.from.poolId ?? '',
    positionId: step.allocation?.position.positionId ?? '',
    fromAllocationId: step.allocation?.params.from.allocationId ?? '',
    toChannelId: channelId,
    spends,
    fees: [],
    channelOps: step.channelUpdate
      ? [{ channelId: step.channelUpdate.channel.channelId, operation: step.channelUpdate.operation }]
      : [],
    simulation: step.simulation,
    quoteTimestamp: step.quoteTimestamp,
    executionReceipt: step.executionReceipt,
    postconditionsVerified: step.postconditionsVerified,
  };
  const prepared: PreparedStep = {
    stepId: step.stepId,
    action: step.action,
    nonce: step.nonce,
    operation,
  };
  const canonical = reduceToCanonicalAction(runId, principal, agentId, prepared, {
    simulation: step.simulation,
    quoteTimestamp: step.quoteTimestamp,
    executionReceipt: step.executionReceipt,
    postconditionsVerified: step.postconditionsVerified,
  });
  return { canonical, prepared };
}

/**
 * Execute one autonomous rebalance step end-to-end:
 * prepare → reduce → authorize → execute → commit / abort.
 *
 * On approval the step is executed against the live port (channel update and/or
 * pool allocation), then the reservation is committed with the tx digest as
 * the execution proof. On failure the reservation is aborted and the error
 * rethrown so the caller can apply its failure budget.
 */
export async function executeAutonomousRebalanceStep(
  options: AutonomousRebalanceOptions,
  step: PreparedRebalanceStep,
): Promise<AutonomousRebalanceResult> {
  const { canonical, prepared } = prepareRebalanceStep(options.runId, options.principal, options.agentId, step);

  const authorization = await options.policy.authorizeAndReserve({
    runId: options.runId,
    stepId: step.stepId,
    nonce: step.nonce,
    action: canonical,
    evidence: {
      simulation: step.simulation,
      quoteTimestamp: step.quoteTimestamp,
      executionReceipt: step.executionReceipt,
      postconditionsVerified: step.postconditionsVerified,
    },
  });

  if (authorization.outcome !== 'approved') {
    return { outcome: authorization.outcome, rejection: authorization, canonical };
  }

  const txDigest = step.draft ? bytesToHex(computeOmniaTxDigest(step.draft)) : undefined;

  try {
    let channelUpdate: RebalanceChannelUpdate | undefined;
    if (step.channelUpdate) {
      const signedState = await options.ctx?.omnia?.updateState(
        step.channelUpdate.channel,
        { newBalances: step.channelUpdate.newBalances },
      );
      if (signedState) {
        channelUpdate = {
          channel: step.channelUpdate.channel,
          newBalances: step.channelUpdate.newBalances,
          operation: step.channelUpdate.operation,
        };
      }
    }

    let allocation: AutonomousRebalanceResult['allocation'];
    if (step.allocation) {
      const result = await rebalancePoolCapital(
        step.allocation.params,
        step.allocation.position,
        step.allocation.registry,
      );
      allocation = result;
    }

    await options.policy.commit({
      reservationId: authorization.reservationId,
      executionProof: { txDigest, channelUpdate: channelUpdate?.channel.channelId },
    });

    return { outcome: 'approved', authorization, canonical, txDigest, channelUpdate, allocation };
  } catch (error) {
    await options.policy.abort(authorization.reservationId, error);
    throw error;
  }
}
