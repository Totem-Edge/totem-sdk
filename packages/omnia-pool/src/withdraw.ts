/**
 * omnia-pool/withdraw.ts — Withdrawal primitives.
 */

import { hexToBytes, scriptFromWotsPk, scriptToAddress } from '@totemsdk/core';
import {
  approveWithdrawalIntent,
  consumeLiquidityReceipt,
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
import type { ExecutePoolPayoutParams, OmniaPoolAllocationContext, OmniaPoolWithdrawalResult, RegistryRootingContext, WithdrawLiquidityOptions } from './types.js';
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
 * Reconcile a channel's LP balance against the payout (#22): the LP party's
 * balance must cover the withdrawal before a settlement is proposed. The LP
 * party is matched by settlement address (falling back to the address derived
 * from the party's public key digest).
 */
function reconcileChannelBalance(
  channel: import('@totemsdk/omnia').OmniaChannel,
  lpAddress: string,
  required: bigint,
): void {
  const party = channel.parties.find(
    (p) => p.settlementAddress === lpAddress || addressFromPkDigestHex(p.publicKeyDigest) === lpAddress,
  );
  if (!party) {
    throw new Error(`channel ${channel.channelId} has no party for LP ${lpAddress}`);
  }
  const balance = channel.balances[party.partyId] ?? 0n;
  if (balance < required) {
    throw new Error(
      `channel ${channel.channelId} LP balance ${balance} is less than the payout ${required}`,
    );
  }
}

function addressFromPkDigestHex(pkDigestHex: string): string {
  return scriptToAddress(scriptFromWotsPk(hexToBytes(pkDigestHex)));
}

/**
 * Parse the settlement's bound amount. Strings are accepted because finality
 * evidence often arrives over JSON RPC; anything that is not an integer atom
 * amount is rejected (fail closed).
 */
function settlementAmount(settlement: import('./types.js').PayoutFinality): bigint {
  try {
    const amount = BigInt(settlement.amount);
    if (amount < 0n) throw new Error('negative');
    return amount;
  } catch {
    throw new Error(`payout settlement amount ${String(settlement.amount)} is not a valid atom amount`);
  }
}

/**
 * Local binding check: the evidence must name this exact payout before it is
 * even handed to the verifier. This catches cross-withdrawal / cross-pool /
 * redirected-destination evidence without trusting the verifier's coverage.
 */
function assertSettlementBinding(params: ExecutePoolPayoutParams): void {
  const settlement = params.settlement!;
  if (!settlement.evidenceRef) {
    throw new Error('payout settlement evidenceRef is required');
  }
  if (settlement.withdrawalId !== params.intent.withdrawalId) {
    throw new Error(
      `payout settlement is for withdrawal ${settlement.withdrawalId}, not ${params.intent.withdrawalId}`,
    );
  }
  if (settlement.poolId !== params.pool.poolId) {
    throw new Error(`payout settlement is for pool ${settlement.poolId}, not ${params.pool.poolId}`);
  }
  if (settlement.positionId !== params.position.positionId) {
    throw new Error(
      `payout settlement is for position ${settlement.positionId}, not ${params.position.positionId}`,
    );
  }
  if (settlement.recipientAddress !== params.recipientAddress) {
    throw new Error(
      `payout settlement pays ${settlement.recipientAddress}, not the requested recipient ${params.recipientAddress}`,
    );
  }
  const amount = settlementAmount(settlement);
  if (amount !== params.intent.amount) {
    throw new Error(`payout settlement amount ${amount} does not match the withdrawal amount ${params.intent.amount}`);
  }
  // The withdrawal intent fixes who may be paid; evidence for a redirected
  // payout must not settle it.
  if (params.recipientAddress !== params.intent.ownerAddress) {
    throw new Error(
      `payout recipient ${params.recipientAddress} does not match the withdrawal intent owner ${params.intent.ownerAddress}`,
    );
  }
}

/**
 * Verify a payout's finality against a real evidence source. Returns normally
 * only when the caller-supplied verifier confirms the settled payout; throws
 * (leaving the registry untouched) otherwise. No settlement path bypasses this.
 */
async function verifyPayoutFinality(params: ExecutePoolPayoutParams): Promise<void> {
  const verifier = params.settlementVerifier ?? params.ctx?.settlementVerifier;
  if (!verifier || typeof verifier.verifySettlement !== 'function') {
    throw new Error(
      'executePoolPayout refuses to settle without a settlement verifier (finality evidence cannot be self-asserted)',
    );
  }
  assertSettlementBinding(params);
  const verdict = await verifier.verifySettlement({
    settlement: params.settlement!,
    poolId: params.pool.poolId,
    positionId: params.position.positionId,
    withdrawalId: params.intent.withdrawalId,
    recipientAddress: params.recipientAddress,
    amount: params.intent.amount,
  });
  if (!verdict || verdict.valid !== true) {
    throw new Error(`payout settlement not verified: ${verdict?.reason ?? 'unknown'}`);
  }
}

/**
 * Execute a payout for an approved withdrawal intent.
 * For VTXO-backed positions this creates an exit draft; for channel-backed
 * positions it requests a settlement payload. Pure-record positions return the
 * intent only and expect the caller to handle settlement externally.
 *
 * RFC-048 §3.3: a prepared draft is not a payout. When `settlement` is supplied
 * it is verified *before* any execution side effect; only verified evidence may
 * mark the intent settled, decrement LP capital and consume the receipt.
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

  // Verify finality first: a forged or unverifiable settlement must not reach
  // any channel/VTXO side effect, let alone the accounting mutation below.
  if (params.settlement) {
    await verifyPayoutFinality(params);
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
    // Reconcile the LP's on-channel balance against the payout before settling (#22).
    reconcileChannelBalance(channel, params.position.lpAddress, params.intent.amount);
    const settlement = await params.ctx.omnia.proposeSettlement(channel);
    if (params.ctx.saveChannelSnapshot) await params.ctx.saveChannelSnapshot(channel);
    execution = settlement;
  }

  // RFC-048 §3.3: a prepared draft (exit draft / settlement proposal) is NOT a
  // completed payout. Without verifiable finality evidence, do NOT consume the
  // receipt, decrement LP capital, or mark the intent settled — return the
  // prepared execution and leave the position and registry unchanged.
  if (!params.settlement) {
    return {
      intent: params.intent,
      position: params.position,
      registry,
      execution,
    };
  }

  // Mark position withdrawn for the requested amount and close the intent.
  const settledIntent: WithdrawalIntent = {
    ...params.intent,
    status: 'settled-externally',
    metadata: { ...(params.intent.metadata ?? {}), settlement: params.settlement },
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

  // Atomic receipt consumption (#23): the receipt is single-spent in the same
  // transition that settles the withdrawal — a replayed receipt can never
  // double-withdraw.
  const receipt = nextRegistry.receipts[params.position.receiptId ?? ''];
  if (receipt) {
    const consumed = consumeLiquidityReceipt(receipt, settledIntent.withdrawalId);
    nextRegistry = { ...nextRegistry, receipts: { ...nextRegistry.receipts, [consumed.receiptId]: consumed } };
  }

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
