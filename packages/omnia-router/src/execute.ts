import { bytesToHex, sha3_256 } from '@totemsdk/core';
import {
  expectationFromRequest,
  validateChannelSpend,
  validateRoute,
  validateRouteForPayment,
  validateRoutingHop,
  swapIntermediary,
} from './route-validation.js';
import { assertExpiryFits, hopTimeoutBlock, resolveHopExpiryDelta, type RouteExpiryOptions } from './expiry.js';
import { SCALE } from './rates.js';
import type {
  ChannelOps,
  RouterChannel,
  Route,
  CrossTokenRoute,
  PaymentRequest,
  PaymentResult,
  PendingRefund,
  LeaseProvider,
  SwapHop,
  RoutingHop,
  ChannelHTLC,
  RouterFeeProof,
} from './types.js';

// ─── Type guard ───────────────────────────────────────────────────────────────

function isSwapHop(hop: RoutingHop | SwapHop): hop is SwapHop {
  return (hop as SwapHop).isSwap === true;
}

function revalidationErrorCode(message: string): string | undefined {
  return message.includes('ROUTE_REVALIDATION_FAILED') ? 'ROUTE_REVALIDATION_FAILED' : undefined;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Determine the counterparty public key digest relative to the local signer. */
function counterpartPkd(channel: RouterChannel): string {
  const localPkd = channel.localSigner?.publicKeyDigest;
  const other = channel.parties.find(p => p.publicKeyDigest !== localPkd);
  if (!other) throw new Error(`Channel ${channel.channelId}: cannot determine counterpart`);
  return other.publicKeyDigest;
}

/**
 * Best-effort timeout of a set of locked HTLCs.
 * Errors from individual timeoutHTLC calls are silently ignored so rollback
 * always completes as many cancellations as possible.
 */
/** Raised when rollback could not release every HTLC (CAN-015). */
export class PendingRefundError extends Error {
  constructor(public readonly pendingRefunds: PendingRefund[]) {
    super(
      `${pendingRefunds.length} HTLC(s) could not be released before their timeout block; `
      + 'liquidity remains locked',
    );
    this.name = 'PendingRefundError';
  }
}

async function cancelHtlcs(
  ops:            ChannelOps,
  channels:       Map<string, RouterChannel>,
  locked:         Array<{ channelId: string; htlcId: string }>,
  leaseProviders: Map<string, LeaseProvider>,
  pending:        PendingRefund[],
): Promise<void> {
  for (const { channelId, htlcId } of [...locked].reverse()) {
    const ch = channels.get(channelId);
    const lp = leaseProviders.get(channelId);
    if (!ch || !lp) {
      // OMN-080: without the channel or its lease provider this HTLC cannot be
      // timed out here, but it is still locked. Reporting a clean rollback would
      // hide liquidity that the caller must reconcile, so record the obligation.
      pending.push({
        channelId,
        htlcId,
        reason: !ch
          ? 'channel state is not loaded; the lock could not be released'
          : 'no lease provider for this channel; the lock could not be released',
      });
      continue;
    }
    try {
      const res = await ops.timeoutHTLC(ch, htlcId, lp);
      channels.set(channelId, res.channel);
    } catch (err) {
      // CAN-015: timeoutHTLC refuses to release before the timeout block, which
      // is the normal case for a payment that just failed. Record the lock
      // instead of reporting a clean failure.
      const htlc = ch.pendingHTLCs.find(h => h.htlcId === htlcId);
      pending.push({
        channelId,
        htlcId,
        reason: err instanceof Error ? err.message : String(err),
        ...(htlc ? { timeoutBlock: htlc.timeoutBlock.toString() } : {}),
      });
    }
  }
}

// ─── Single-token multi-hop payment ──────────────────────────────────────────

/**
 * Execute a single-token multi-hop payment atomically:
 *
 * 1. Forward phase — lock HTLCs across each hop in route.hops.
 * 2. Reveal phase — reveal preimage via fulfillHTLC in reverse order.
 *
 * Rollback (best-effort timeoutHTLC on all still-pending locks) fires on ANY
 * failure, including failures that occur during the reveal phase — so stranded
 * HTLCs are never left behind silently.
 *
 * `paymentRequest.preimage` MUST be set (buildPaymentRequest sets it).
 *
 * The `channels` map is updated in-place after each HTLC operation.
 */
export async function executeMultiHopPayment(
  ops:            ChannelOps,
  channels:       Map<string, RouterChannel>,
  route:          Route,
  paymentRequest: PaymentRequest,
  leaseProviders: Map<string, LeaseProvider>,
  expiryOptions:  RouteExpiryOptions = {},
): Promise<PaymentResult> {
  /** Locks rollback could not release (CAN-015). */
  const pendingRefunds: PendingRefund[] = [];
  const failed = (result: PaymentResult): PaymentResult =>
    pendingRefunds.length > 0 ? { ...result, pendingRefunds: [...pendingRefunds] } : result;
  const preimage = paymentRequest.preimage;
  if (!preimage) {
    return failed({ success: false, state: 'failed', terminal: true, error: 'paymentRequest.preimage is required for execution', settledHops: [] });
  }

  const plainHops = route.hops.filter(h => !isSwapHop(h)) as RoutingHop[];

  // Fee-aware per-hop amounts. Each hop locks the payment plus the fees of the
  // downstream intermediaries; the fee for the final edge belongs to the
  // recipient and is not charged. Intermediary i retains
  // hopAmount[i] - hopAmount[i+1]. With no fee rates this is the legacy
  // same-amount behaviour.
  const fees = plainHops.map((hop) =>
    hop.feeRate && hop.feeRate > 0n ? (paymentRequest.amount * hop.feeRate) / SCALE : 0n,
  );
  for (let i = 0; i < plainHops.length; i++) {
    const downstream = fees.slice(i, Math.max(i, fees.length - 1)).reduce((a, b) => a + b, 0n);
    plainHops[i].amount = paymentRequest.amount + downstream;
  }

  // OMN-078: a hop-by-hop check cannot see that the route is empty, stops short
  // of the recipient, or carries the wrong asset. Bind it to the payment first.
  const paymentValidation = validateRouteForPayment(route, expectationFromRequest(paymentRequest));
  if (!paymentValidation.ok) {
    return failed({
      success: false,
      error: `ROUTE_VALIDATION_FAILED: ${paymentValidation.error}`,
      errorCode: 'ROUTE_VALIDATION_FAILED',
      settledHops: [],
    });
  }

  const routeValidation = validateRoute(channels, route);
  if (!routeValidation.ok) {
    return failed({
      success: false,
      error: `ROUTE_REVALIDATION_FAILED: ${routeValidation.error}`,
      errorCode: 'ROUTE_REVALIDATION_FAILED',
      settledHops: [],
    });
  }

  // OMN-079: consecutive hops are separated by the contest window, not one
  // block, and a request without room for that is rejected before locking.
  let expiryDelta: bigint;
  try {
    expiryDelta = resolveHopExpiryDelta(expiryOptions);
    assertExpiryFits(paymentRequest.expiryBlock, plainHops.length, expiryDelta);
  } catch (err) {
    return failed({
      success: false,
      error: `EXPIRY_TOO_SOON: ${err instanceof Error ? err.message : String(err)}`,
      errorCode: 'EXPIRY_TOO_SOON',
      settledHops: [],
    });
  }

  const locked: Array<{ channelId: string; htlcId: string }> = [];

  // ── Forward: lock HTLCs ───────────────────────────────────────────────────
  for (let i = 0; i < plainHops.length; i++) {
    const hop     = plainHops[i];
    const channel = channels.get(hop.channelId);
    if (!channel) {
      await cancelHtlcs(ops, channels, locked, leaseProviders, pendingRefunds);
      return failed({ success: false, error: `Channel ${hop.channelId} not found`, settledHops: [] });
    }
    const lp = leaseProviders.get(hop.channelId);
    if (!lp) {
      await cancelHtlcs(ops, channels, locked, leaseProviders, pendingRefunds);
      return failed({ success: false, error: `No lease provider for channel ${hop.channelId}`, settledHops: [] });
    }
    const hopValidation = validateRoutingHop(channels, hop);
    if (!hopValidation.ok) {
      await cancelHtlcs(ops, channels, locked, leaseProviders, pendingRefunds);
      return failed({
        success: false,
        error: `ROUTE_REVALIDATION_FAILED: ${hopValidation.error}`,
        errorCode: 'ROUTE_REVALIDATION_FAILED',
        settledHops: [],
      });
    }

    // Timeouts decrease toward the recipient by a full contest window, so an
    // upstream hop survives a downstream failure long enough to be resolved.
    let timeoutBlock: bigint;
    try {
      timeoutBlock = hopTimeoutBlock(paymentRequest.expiryBlock, i, expiryDelta);
    } catch (err) {
      await cancelHtlcs(ops, channels, locked, leaseProviders, pendingRefunds);
      return failed({
        success: false,
        error: `EXPIRY_TOO_SOON: ${err instanceof Error ? err.message : String(err)}`,
        errorCode: 'EXPIRY_TOO_SOON',
        settledHops: [],
      });
    }

    let addResult: { channel: RouterChannel; htlcId: string; error?: string };
    try {
      addResult = await ops.addHTLC(channel, {
        amount:                     hop.amount,
        hashlock:                   paymentRequest.hashlock,
        timeoutBlock,
        direction:                  'offered',
        counterpartPublicKeyDigest: counterpartPkd(channel),
      }, lp);
    } catch (err) {
      await cancelHtlcs(ops, channels, locked, leaseProviders, pendingRefunds);
      return failed({ success: false, error: String(err), settledHops: [] });
    }

    if (addResult.error) {
      await cancelHtlcs(ops, channels, locked, leaseProviders, pendingRefunds);
      return failed({ success: false, error: addResult.error, settledHops: [] });
    }

    channels.set(hop.channelId, addResult.channel);
    hop.htlcId = addResult.htlcId;
    locked.push({ channelId: hop.channelId, htlcId: addResult.htlcId });
  }

  // ── Backward: reveal preimage ─────────────────────────────────────────────
  // Track fulfilled IDs so that on failure we can timeout only the still-pending
  // ones (already-fulfilled HTLCs are irreversible and must not be retouched).
  const settled: string[]    = [];
  const fulfilledSet         = new Set<string>();
  const feeProofs: RouterFeeProof[] = [];

  for (const { channelId, htlcId } of [...locked].reverse()) {
    const channel = channels.get(channelId)!;
    const lp      = leaseProviders.get(channelId)!;

    let fulfillResult: { channel: RouterChannel; error?: string };
    try {
      fulfillResult = await ops.fulfillHTLC(channel, htlcId, preimage, lp);
    } catch (err) {
      // Timeout every still-pending lock (not yet fulfilled)
      const stillPending = locked.filter(h => !fulfilledSet.has(h.htlcId));
      await cancelHtlcs(ops, channels, stillPending, leaseProviders, pendingRefunds);
      return failed({ success: false, error: String(err), settledHops: settled });
    }

    if (fulfillResult.error) {
      const stillPending = locked.filter(h => !fulfilledSet.has(h.htlcId));
      await cancelHtlcs(ops, channels, stillPending, leaseProviders, pendingRefunds);
      return failed({ success: false, error: fulfillResult.error, settledHops: settled });
    }

    channels.set(channelId, fulfillResult.channel);
    settled.push(htlcId);
    fulfilledSet.add(htlcId);

    // Build the verifiable fee proof for this settled hop (#29).
    const htlc = fulfillResult.channel.pendingHTLCs.find(h => h.htlcId === htlcId);
    if (htlc) {
      feeProofs.push(buildRouterFeeProof(fulfillResult.channel, htlc, Date.now()));
    }
  }

  return {
    success: true,
    state: 'recipient-settled',
    terminal: true,
    preimage,
    settledHops: settled,
    feeProofs,
  };
}

export const ROUTER_FEE_PROOF_DOMAIN = 'totemsdk/omnia-router/fee-proof/v1';

/**
 * Build a fee-provenance record for a settled hop (#29).
 *
 * When the channel exposes its authenticated state commitment the record is
 * bound to that state (`evidence: 'state-bound'`). Otherwise it is marked
 * `descriptive`: the hash proves the record was not edited, not that the
 * payment settled, and downstream accounting must not credit it (OMN-081).
 */
export function buildRouterFeeProof(
  channel: RouterChannel,
  htlc: ChannelHTLC,
  settledAt?: number,
): RouterFeeProof {
  const ts = settledAt ?? Date.now();
  const commitment = channel.stateCommitment;
  const proof: RouterFeeProof = {
    channelId: channel.channelId,
    htlcId: htlc.htlcId,
    recipientPublicKeyDigest: htlc.recipientPublicKeyDigest,
    amount: htlc.amount,
    tokenId: channel.tokenId,
    settledAt: ts,
    evidence: commitment ? 'state-bound' : 'descriptive',
    ...(commitment ? { stateCommitment: { sequence: commitment.sequence, hash: commitment.hash } } : {}),
    proofHash: '',
  };
  proof.proofHash = computeRouterFeeProofHash(proof);
  return proof;
}

/** True when the proof is bound to an authenticated channel state. */
export function isStateBoundFeeProof(proof: RouterFeeProof): boolean {
  return proof.evidence === 'state-bound'
    && typeof proof.stateCommitment?.hash === 'string'
    && proof.stateCommitment.hash.length > 0;
}

/**
 * Verify a fee proof.
 *
 * Recomputation alone only proves the fields were not edited. A proof is
 * accepted as settlement evidence only when it is state-bound and, if the caller
 * knows the expected commitment, that commitment matches. Pass an expected
 * commitment whenever the caller has chain or channel state to compare against.
 */
export function verifyRouterFeeProof(
  proof: RouterFeeProof,
  expected?: { channelId?: string; stateCommitment?: { sequence: number; hash: string } },
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!isStateBoundFeeProof(proof)) {
    errors.push('fee proof is descriptive; it does not prove settlement');
  }
  if (expected?.channelId !== undefined && proof.channelId !== expected.channelId) {
    errors.push(`fee proof channel ${proof.channelId} does not match ${expected.channelId}`);
  }
  if (expected?.stateCommitment) {
    if (!proof.stateCommitment) {
      errors.push('fee proof carries no state commitment');
    } else if (proof.stateCommitment.hash !== expected.stateCommitment.hash
      || proof.stateCommitment.sequence !== expected.stateCommitment.sequence) {
      errors.push('fee proof state commitment does not match the expected channel state');
    }
  }
  if (proof.proofHash !== computeRouterFeeProofHash(proof)) {
    errors.push('fee proof hash does not match its contents');
  }
  return { ok: errors.length === 0, errors };
}

export function computeRouterFeeProofHash(proof: RouterFeeProof): string {
  const { proofHash, ...rest } = proof;
  const input = `${ROUTER_FEE_PROOF_DOMAIN}|${canonicalJson(rest)}`;
  return bytesToHex(sha3_256(new TextEncoder().encode(input)));
}

function canonicalJson(value: unknown): string {
  if (typeof value === 'bigint') return JSON.stringify({ __bigint: value.toString() });
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const pairs = keys
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`)
      .filter((p) => p !== `${JSON.stringify('')}:null`);
    return `{${pairs.join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Cancel all pending HTLCs on a route by calling timeoutHTLC on each hop.
 * Call this explicitly to roll back before or without attempting execution.
 */
export async function cancelPayment(
  ops:            ChannelOps,
  channels:       Map<string, RouterChannel>,
  route:          Route,
  leaseProviders: Map<string, LeaseProvider>,
): Promise<void> {
  const hopsWithHtlc = route.hops.filter(h => h.htlcId && !isSwapHop(h)) as RoutingHop[];
  // CAN-015: cancellation is best-effort; locks that are still before their
  // timeout block are collected rather than silently reported as released.
  const pendingRefunds: PendingRefund[] = [];
  await cancelHtlcs(
    ops,
    channels,
    hopsWithHtlc.map(h => ({ channelId: h.channelId, htlcId: h.htlcId! })),
    leaseProviders,
    pendingRefunds,
  );
  if (pendingRefunds.length > 0) {
    throw new PendingRefundError(pendingRefunds);
  }
}

// ─── Cross-token multi-hop payment ───────────────────────────────────────────

/**
 * Execute a cross-token payment atomically.
 *
 * For each SwapHop:
 *   1. Lock the inbound HTLC (tokenIn side).
 *   2. Lock the outbound HTLC (tokenOut side).
 *   Both use the same hashlock — the intermediary can only claim by revealing
 *   the preimage on both sides simultaneously.
 *
 * Then forward-locks all remaining non-swap hops, and reveals the preimage
 * backwards across all locked channels.
 *
 * Rollback fires on ANY failure (forward OR backward phase) by timing out
 * all still-pending locked HTLCs.
 */
export async function executeCrossTokenPayment(
  ops:            ChannelOps,
  channels:       Map<string, RouterChannel>,
  route:          CrossTokenRoute,
  paymentRequest: PaymentRequest,
  leaseProviders: Map<string, LeaseProvider>,
  expiryOptions:  RouteExpiryOptions = {},
): Promise<PaymentResult> {
  /** Locks rollback could not release (CAN-015). */
  const pendingRefunds: PendingRefund[] = [];
  const failed = (result: PaymentResult): PaymentResult =>
    pendingRefunds.length > 0 ? { ...result, pendingRefunds: [...pendingRefunds] } : result;
  const preimage = paymentRequest.preimage;
  if (!preimage) {
    return failed({ success: false, state: 'failed', terminal: true, error: 'paymentRequest.preimage is required for execution', settledHops: [] });
  }

  const paymentValidation = validateRouteForPayment(route, expectationFromRequest(paymentRequest));
  if (!paymentValidation.ok) {
    return failed({
      success: false,
      error: `ROUTE_VALIDATION_FAILED: ${paymentValidation.error}`,
      errorCode: 'ROUTE_VALIDATION_FAILED',
      settledHops: [],
    });
  }

  const routeValidation = validateRoute(channels, route);
  if (!routeValidation.ok) {
    return failed({
      success: false,
      error: `ROUTE_REVALIDATION_FAILED: ${routeValidation.error}`,
      errorCode: 'ROUTE_REVALIDATION_FAILED',
      settledHops: [],
    });
  }

  // One HTLC per hop leg: a swap hop locks two, so the room check counts legs.
  const legCount = route.hops.reduce((count, hop) => count + (isSwapHop(hop) ? 2 : 1), 0);
  let expiryDelta: bigint;
  try {
    expiryDelta = resolveHopExpiryDelta(expiryOptions);
    assertExpiryFits(paymentRequest.expiryBlock, legCount, expiryDelta);
  } catch (err) {
    return failed({
      success: false,
      error: `EXPIRY_TOO_SOON: ${err instanceof Error ? err.message : String(err)}`,
      errorCode: 'EXPIRY_TOO_SOON',
      settledHops: [],
    });
  }

  const locked: Array<{ channelId: string; htlcId: string }> = [];

  /**
   * Lock a single HTLC, add it to `locked`, and return the htlcId.
   * Throws on any error so callers can handle rollback uniformly.
   */
  async function lockHTLC(
    channelId:    string,
    amount:       bigint,
    hashlock:     string,
    timeoutBlock: bigint,
    tokenId:      string,
    sender:       string,
  ): Promise<string> {
    const channel = channels.get(channelId);
    const lp      = leaseProviders.get(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found`);
    if (!lp)      throw new Error(`No lease provider for channel ${channelId}`);
    const spend = validateChannelSpend(channel, sender, amount, tokenId);
    if (!spend.ok) throw new Error(`ROUTE_REVALIDATION_FAILED: ${spend.error}`);

    // Let addHTLC exceptions propagate — they carry the original error message.
    const result = await ops.addHTLC(channel, {
      amount,
      hashlock,
      timeoutBlock,
      direction: 'offered',
      counterpartPublicKeyDigest: counterpartPkd(channel),
    }, lp);

    if (result.error) throw new Error(result.error);
    channels.set(channelId, result.channel);
    locked.push({ channelId, htlcId: result.htlcId });
    return result.htlcId;
  }

  // ── Lock HTLCs in full route order with monotonically decreasing timeouts ──
  //
  // Correct HTLC safety requires timeouts to DECREASE toward the recipient:
  //   sender (highest timeout) → ... → recipient (lowest timeout)
  //
  // We iterate route.hops in their declared order.  For each RoutingHop we
  // consume one position.  For each SwapHop we consume two consecutive
  // positions: inbound channel first (higher timeout), outbound second (lower).
  //
  //   position 0: preHops[0]          ← highest timeout
  //   position 1: preHops[1]
  //   ...
  //   position k:   swapInbound
  //   position k+1: swapOutbound
  //   ...
  //   position n: postHops[last]      ← lowest timeout

  let pos = 0;
  for (const hop of route.hops) {
    if (isSwapHop(hop)) {
      // Inbound channel (sender → intermediary, tokenIn side)
      const inTimeout = hopTimeoutBlock(paymentRequest.expiryBlock, pos++, expiryDelta);
      try {
        hop.htlcId = await lockHTLC(
          hop.inboundChannelId,
          hop.amountIn,
          paymentRequest.hashlock,
          inTimeout,
          hop.tokenIn,
          hop.from,
        );
      } catch (err) {
        await cancelHtlcs(ops, channels, locked, leaseProviders, pendingRefunds);
        return failed({ success: false, error: `Inbound HTLC lock failed: ${String(err)}`, ...(revalidationErrorCode(String(err)) ? { errorCode: 'ROUTE_REVALIDATION_FAILED' } : {}), settledHops: [] });
      }

      // Outbound channel (intermediary → recipient, tokenOut side)
      const outTimeout = hopTimeoutBlock(paymentRequest.expiryBlock, pos++, expiryDelta);
      const intermediary = swapIntermediary(channels, hop);
      if (!intermediary) {
        await cancelHtlcs(ops, channels, locked, leaseProviders, pendingRefunds);
        return failed({
          success: false,
          error: `ROUTE_REVALIDATION_FAILED: no intermediary for ${hop.inboundChannelId}`,
          errorCode: 'ROUTE_REVALIDATION_FAILED',
          settledHops: [],
        });
      }
      try {
        await lockHTLC(
          hop.outboundChannelId,
          hop.amountOut,
          paymentRequest.hashlock,
          outTimeout,
          hop.tokenOut,
          intermediary,
        );
      } catch (err) {
        await cancelHtlcs(ops, channels, locked, leaseProviders, pendingRefunds);
        return failed({ success: false, error: `Outbound HTLC lock failed: ${String(err)}`, ...(revalidationErrorCode(String(err)) ? { errorCode: 'ROUTE_REVALIDATION_FAILED' } : {}), settledHops: [] });
      }
    } else {
      const timeout = hopTimeoutBlock(paymentRequest.expiryBlock, pos++, expiryDelta);
      try {
        hop.htlcId = await lockHTLC(
          hop.channelId,
          hop.amount,
          paymentRequest.hashlock,
          timeout,
          hop.tokenId,
          hop.from,
        );
      } catch (err) {
        await cancelHtlcs(ops, channels, locked, leaseProviders, pendingRefunds);
        return failed({ success: false, error: `Hop HTLC lock failed: ${String(err)}`, ...(revalidationErrorCode(String(err)) ? { errorCode: 'ROUTE_REVALIDATION_FAILED' } : {}), settledHops: [] });
      }
    }
  }

  // ── Reveal preimage backward ──────────────────────────────────────────────
  const settled: string[]   = [];
  const fulfilledSet        = new Set<string>();

  for (const { channelId, htlcId } of [...locked].reverse()) {
    const channel = channels.get(channelId)!;
    const lp      = leaseProviders.get(channelId)!;

    let fulfillResult: { channel: RouterChannel; error?: string };
    try {
      fulfillResult = await ops.fulfillHTLC(channel, htlcId, preimage, lp);
    } catch (err) {
      const stillPending = locked.filter(h => !fulfilledSet.has(h.htlcId));
      await cancelHtlcs(ops, channels, stillPending, leaseProviders, pendingRefunds);
      return failed({ success: false, error: String(err), settledHops: settled });
    }

    if (fulfillResult.error) {
      const stillPending = locked.filter(h => !fulfilledSet.has(h.htlcId));
      await cancelHtlcs(ops, channels, stillPending, leaseProviders, pendingRefunds);
      return failed({ success: false, error: fulfillResult.error, settledHops: settled });
    }

    channels.set(channelId, fulfillResult.channel);
    settled.push(htlcId);
    fulfilledSet.add(htlcId);
  }

  return { success: true, preimage, settledHops: settled };
}
