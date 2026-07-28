import type {
  ChannelOps,
  RouterChannel,
  Route,
  CrossTokenRoute,
  PaymentRequest,
  PaymentResult,
  LeaseProvider,
  SwapHop,
  RoutingHop,
} from './types.js';

// ─── Type guard ───────────────────────────────────────────────────────────────

function isSwapHop(hop: RoutingHop | SwapHop): hop is SwapHop {
  return (hop as SwapHop).isSwap === true;
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
async function cancelHtlcs(
  ops:            ChannelOps,
  channels:       Map<string, RouterChannel>,
  locked:         Array<{ channelId: string; htlcId: string }>,
  leaseProviders: Map<string, LeaseProvider>,
): Promise<void> {
  for (const { channelId, htlcId } of [...locked].reverse()) {
    const ch = channels.get(channelId);
    const lp = leaseProviders.get(channelId);
    if (!ch || !lp) continue;
    try {
      const res = await ops.timeoutHTLC(ch, htlcId, lp);
      channels.set(channelId, res.channel);
    } catch { /* best-effort: continue rolling back other hops */ }
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
): Promise<PaymentResult> {
  const preimage = paymentRequest.preimage;
  if (!preimage) {
    return { success: false, error: 'paymentRequest.preimage is required for execution', settledHops: [] };
  }

  const plainHops = route.hops.filter(h => !isSwapHop(h)) as RoutingHop[];
  const locked: Array<{ channelId: string; htlcId: string }> = [];

  // ── Forward: lock HTLCs ───────────────────────────────────────────────────
  for (let i = 0; i < plainHops.length; i++) {
    const hop     = plainHops[i];
    const channel = channels.get(hop.channelId);
    if (!channel) {
      await cancelHtlcs(ops, channels, locked, leaseProviders);
      return { success: false, error: `Channel ${hop.channelId} not found`, settledHops: [] };
    }
    const lp = leaseProviders.get(hop.channelId);
    if (!lp) {
      await cancelHtlcs(ops, channels, locked, leaseProviders);
      return { success: false, error: `No lease provider for channel ${hop.channelId}`, settledHops: [] };
    }

    // Timeouts decrease toward the recipient so each hop has time to claim.
    const timeoutBlock = paymentRequest.expiryBlock - BigInt(i);

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
      await cancelHtlcs(ops, channels, locked, leaseProviders);
      return { success: false, error: String(err), settledHops: [] };
    }

    if (addResult.error) {
      await cancelHtlcs(ops, channels, locked, leaseProviders);
      return { success: false, error: addResult.error, settledHops: [] };
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

  for (const { channelId, htlcId } of [...locked].reverse()) {
    const channel = channels.get(channelId)!;
    const lp      = leaseProviders.get(channelId)!;

    let fulfillResult: { channel: RouterChannel; error?: string };
    try {
      fulfillResult = await ops.fulfillHTLC(channel, htlcId, preimage, lp);
    } catch (err) {
      // Timeout every still-pending lock (not yet fulfilled)
      const stillPending = locked.filter(h => !fulfilledSet.has(h.htlcId));
      await cancelHtlcs(ops, channels, stillPending, leaseProviders);
      return { success: false, error: String(err), settledHops: settled };
    }

    if (fulfillResult.error) {
      const stillPending = locked.filter(h => !fulfilledSet.has(h.htlcId));
      await cancelHtlcs(ops, channels, stillPending, leaseProviders);
      return { success: false, error: fulfillResult.error, settledHops: settled };
    }

    channels.set(channelId, fulfillResult.channel);
    settled.push(htlcId);
    fulfilledSet.add(htlcId);
  }

  return { success: true, preimage, settledHops: settled };
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
  await cancelHtlcs(
    ops,
    channels,
    hopsWithHtlc.map(h => ({ channelId: h.channelId, htlcId: h.htlcId! })),
    leaseProviders,
  );
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
): Promise<PaymentResult> {
  const preimage = paymentRequest.preimage;
  if (!preimage) {
    return { success: false, error: 'paymentRequest.preimage is required for execution', settledHops: [] };
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
  ): Promise<string> {
    const channel = channels.get(channelId);
    const lp      = leaseProviders.get(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found`);
    if (!lp)      throw new Error(`No lease provider for channel ${channelId}`);

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
      const inTimeout = paymentRequest.expiryBlock - BigInt(pos++);
      try {
        hop.htlcId = await lockHTLC(
          hop.inboundChannelId,
          hop.amountIn,
          paymentRequest.hashlock,
          inTimeout,
        );
      } catch (err) {
        await cancelHtlcs(ops, channels, locked, leaseProviders);
        return { success: false, error: `Inbound HTLC lock failed: ${String(err)}`, settledHops: [] };
      }

      // Outbound channel (intermediary → recipient, tokenOut side)
      const outTimeout = paymentRequest.expiryBlock - BigInt(pos++);
      try {
        await lockHTLC(
          hop.outboundChannelId,
          hop.amountOut,
          paymentRequest.hashlock,
          outTimeout,
        );
      } catch (err) {
        await cancelHtlcs(ops, channels, locked, leaseProviders);
        return { success: false, error: `Outbound HTLC lock failed: ${String(err)}`, settledHops: [] };
      }
    } else {
      const timeout = paymentRequest.expiryBlock - BigInt(pos++);
      try {
        hop.htlcId = await lockHTLC(
          hop.channelId,
          hop.amount,
          paymentRequest.hashlock,
          timeout,
        );
      } catch (err) {
        await cancelHtlcs(ops, channels, locked, leaseProviders);
        return { success: false, error: `Hop HTLC lock failed: ${String(err)}`, settledHops: [] };
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
      await cancelHtlcs(ops, channels, stillPending, leaseProviders);
      return { success: false, error: String(err), settledHops: settled };
    }

    if (fulfillResult.error) {
      const stillPending = locked.filter(h => !fulfilledSet.has(h.htlcId));
      await cancelHtlcs(ops, channels, stillPending, leaseProviders);
      return { success: false, error: fulfillResult.error, settledHops: settled };
    }

    channels.set(channelId, fulfillResult.channel);
    settled.push(htlcId);
    fulfilledSet.add(htlcId);
  }

  return { success: true, preimage, settledHops: settled };
}
