/**
 * omnia-pool/withdraw.ts — Withdrawal primitives.
 */

import {
  approveWithdrawalIntent,
  createWithdrawalIntent,
  attachWithdrawalIntent,
  registerLiquidityPosition,
  markLiquidityPositionQuiescing,
  verifyWithdrawalAllowed,
  type LiquidityBondRegistryState,
  type LiquidityPoolManifest,
  type LiquidityPosition,
  type WithdrawalIntent,
} from '@totemsdk/liquidity-bond';
import type { OmniaPoolAllocationContext, OmniaPoolWithdrawalResult, RegistryRootingContext, WithdrawLiquidityOptions } from './types.js';
import { maybeSignTransition } from './rooting.js';

/**
 * Create a withdrawal intent and mark the position as requesting withdrawal.
 */
export function withdrawLiquidity(
  pool: LiquidityPoolManifest,
  position: LiquidityPosition,
  opts: WithdrawLiquidityOptions,
  registry: LiquidityBondRegistryState,
): OmniaPoolWithdrawalResult {
  const intentForVerify = createWithdrawalIntent({
    positionId: opts.positionId,
    poolId: pool.poolId,
    ownerAddress: opts.recipientAddress,
    amount: BigInt(opts.amount),
  });

  const allowed = verifyWithdrawalAllowed({
    intent: intentForVerify,
    position,
    pool,
    now: Date.now(),
  });
  if (!allowed.ok) {
    throw new Error(allowed.reason ?? 'withdrawal not allowed');
  }

  const intent = createWithdrawalIntent({
    positionId: opts.positionId,
    poolId: pool.poolId,
    ownerAddress: opts.recipientAddress,
    amount: BigInt(opts.amount),
    metadata: opts.reason ? { reason: opts.reason } : undefined,
  });

  const quiesced = markLiquidityPositionQuiescing(position);
  const withIntent: LiquidityPosition = {
    ...quiesced,
    status: 'withdrawal-requested',
  };

  let nextRegistry = attachWithdrawalIntent(registry, intent);
  nextRegistry = registerLiquidityPosition(nextRegistry, withIntent);

  return {
    intent,
    position: withIntent,
    state: nextRegistry,
  };
}

/**
 * Approve a withdrawal intent. Returns the approved intent and updated position.
 */
export function approveWithdrawal(
  intent: WithdrawalIntent,
  position: LiquidityPosition,
  registry: LiquidityBondRegistryState,
): { intent: WithdrawalIntent; registry: LiquidityBondRegistryState } {
  const approved = approveWithdrawalIntent(intent);
  const withdrawals = { ...registry.withdrawals };
  const list = (withdrawals[position.positionId] ?? []).map((w) =>
    w.withdrawalId === approved.withdrawalId ? approved : w,
  );
  withdrawals[position.positionId] = list;
  const nextRegistry: LiquidityBondRegistryState = { ...registry, withdrawals };
  return { intent: approved, registry: nextRegistry };
}

export interface ExecutePoolPayoutParams {
  pool: LiquidityPoolManifest;
  position: LiquidityPosition;
  intent: WithdrawalIntent;
  recipientAddress: string;
  ctx?: OmniaPoolAllocationContext;
  rooting?: RegistryRootingContext;
}

/**
 * Materialize the channel backing a payout: prefer a snapshot already attached
 * in `position.metadata.withdrawalChannel`, else load from `ctx.loadChannel`
 * using the position's `omniaChannelId`.
 */
async function resolveChannelForPayout(params: ExecutePoolPayoutParams): Promise<import('@totemsdk/omnia').OmniaChannel | undefined> {
  const snapshot = params.position.metadata?.withdrawalChannel;
  if (snapshot) return snapshot as never;
  if (params.ctx?.loadChannel && params.position.omniaChannelId) {
    return await params.ctx.loadChannel(params.position.omniaChannelId);
  }
  return undefined;
}

/**
 * Execute a payout for an approved withdrawal intent.
 * For VTXO-backed positions this creates an exit draft; for channel-backed
 * positions it requests a settlement payload. Pure-record positions return the
 * intent only and expect the caller to handle settlement externally.
 */
export async function executePoolPayout(
  params: ExecutePoolPayoutParams,
  registry: LiquidityBondRegistryState,
): Promise<{
  intent: WithdrawalIntent;
  position: LiquidityPosition;
  registry: LiquidityBondRegistryState;
  execution?: unknown;
  signedTransition?: import('@totemsdk/liquidity-bond').RegistrySignedTransition;
}> {
  if (params.intent.status !== 'approved') {
    throw new Error('withdrawal intent must be approved before payout');
  }

  let execution: unknown;
  if (params.position.vtxoPoolId && params.ctx?.vtxo) {
    // In a real implementation the VTXO would be identified from the
    // position metadata; here we require the caller to supply a vtxo via metadata.
    const vtxo = params.position.metadata?.withdrawalVtxo as never;
    if (!vtxo) {
      throw new Error('vtxo-backed withdrawal requires a withdrawalVtxo in position metadata');
    }
    const draft = await params.ctx.vtxo.createExitDraft(vtxo);
    execution = draft;
  } else if (params.position.omniaChannelId && params.ctx?.omnia) {
    // Omnia settlement requires the live channel object; we materialize it from
    // the position's omniaChannelId via ctx.loadChannel (or an attached snapshot).
    const channel = await resolveChannelForPayout(params);
    if (!channel) {
      throw new Error('channel-backed withdrawal requires ctx.loadChannel or a withdrawalChannel in position metadata');
    }
    const settlement = await params.ctx.omnia.proposeSettlement(channel);
    if (params.ctx.saveChannelSnapshot) await params.ctx.saveChannelSnapshot(channel);
    execution = settlement;
  }

  // Mark position withdrawn for the requested amount and close the intent.
  const settledIntent: WithdrawalIntent = {
    ...params.intent,
    status: 'settled-externally',
  };

  const withdrawnAmount = params.intent.amount;
  const remaining = params.position.amount - withdrawnAmount;
  const updatedPosition: LiquidityPosition = {
    ...params.position,
    status: remaining > 0n ? 'active' : 'withdrawn',
    amount: remaining > 0n ? remaining : 0n,
    effectiveAmount: remaining > 0n ? remaining : 0n,
    availableAmount: remaining > 0n ? remaining : 0n,
    allocatedAmount: 0n,
    reservedAmount: 0n,
    updatedAt: Date.now(),
  };

  const withdrawals = { ...registry.withdrawals };
  const list = (withdrawals[params.position.positionId] ?? []).map((w) =>
    w.withdrawalId === settledIntent.withdrawalId ? settledIntent : w,
  );
  withdrawals[params.position.positionId] = list;

  let nextRegistry: LiquidityBondRegistryState = { ...registry, withdrawals };
  nextRegistry = registerLiquidityPosition(nextRegistry, updatedPosition);

  const signedTransition = await maybeSignTransition(params.rooting, nextRegistry, {
    type: 'payout',
    poolId: params.pool.poolId,
    positionId: params.position.positionId,
    withdrawalId: params.intent.withdrawalId,
    amount: withdrawnAmount,
  });

  return {
    intent: settledIntent,
    position: updatedPosition,
    registry: nextRegistry,
    execution,
    signedTransition,
  };
}
