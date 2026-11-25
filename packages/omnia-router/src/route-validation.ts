/**
 * Route revalidation against live channel state (RFC-054 §4 / RFC-055).
 *
 * A route from the router is a *candidate*. Before locking HTLCs the executor
 * must confirm the channels still exist, are active, carry the expected token,
 * have the expected direction and have enough sender balance.
 */
import type {
  ChannelParty,
  PaymentRequest,
  RouterChannel,
  RoutingHop,
  Route,
  SwapHop,
} from './types.js';

export type RouteValidationResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * What the route is supposed to achieve. The executor knows the payment it was
 * asked to make; a route that validates hop-by-hop can still be empty, stop
 * short of the recipient, or switch assets mid-path (OMN-078).
 */
export interface RoutePaymentExpectation {
  tokenId: string;
  amount: bigint;
  /** Payer public key digest; when set, the route must start here. */
  sender?: string;
  /** Recipient public key digest; when set, the route must end here. */
  recipient?: string;
}

function fail(error: string): RouteValidationResult {
  return { ok: false, error };
}

function partyFor(channel: RouterChannel, pkd: string): ChannelParty | undefined {
  return channel.parties.find((party) => party.publicKeyDigest === pkd);
}

function otherParty(channel: RouterChannel, pkd: string): ChannelParty | undefined {
  return channel.parties.find((party) => party.publicKeyDigest !== pkd);
}

/** Validate a single channel spend (status, token, sender, balance). */
export function validateChannelSpend(
  channel:  RouterChannel,
  sender:   string,
  amount:   bigint,
  tokenId:  string,
): RouteValidationResult {
  if (channel.status !== 'active') {
    return fail(`channel ${channel.channelId} is ${channel.status}`);
  }
  if (channel.tokenId !== tokenId) {
    return fail(`channel ${channel.channelId} token ${channel.tokenId} != ${tokenId}`);
  }
  if (amount <= 0n) {
    return fail(`channel ${channel.channelId} spend amount must be positive`);
  }
  const party = partyFor(channel, sender);
  if (!party) {
    return fail(`sender ${sender} is not a party on channel ${channel.channelId}`);
  }
  const balance = channel.balances[party.partyId] ?? 0n;
  if (balance < amount) {
    return fail(
      `insufficient balance on channel ${channel.channelId}: ${balance.toString()} < ${amount.toString()}`,
    );
  }
  return { ok: true };
}

/** Validate a single-token hop. */
export function validateRoutingHop(
  channels: Map<string, RouterChannel>,
  hop:      RoutingHop,
): RouteValidationResult {
  const channel = channels.get(hop.channelId);
  if (!channel) return fail(`channel ${hop.channelId} not found`);
  if (hop.from === hop.to) return fail(`hop ${hop.channelId} has identical from/to`);
  if (!partyFor(channel, hop.to)) {
    return fail(`recipient ${hop.to} is not a party on channel ${hop.channelId}`);
  }
  return validateChannelSpend(channel, hop.from, hop.amount, hop.tokenId);
}

/** The intermediary that connects a swap's inbound and outbound channels. */
export function swapIntermediary(
  channels: Map<string, RouterChannel>,
  hop:      SwapHop,
): string | undefined {
  const inbound = channels.get(hop.inboundChannelId);
  if (!inbound) return undefined;
  return otherParty(inbound, hop.from)?.publicKeyDigest;
}

/** Validate both legs of a swap hop. */
export function validateSwapHop(
  channels: Map<string, RouterChannel>,
  hop:      SwapHop,
): RouteValidationResult {
  const inbound = channels.get(hop.inboundChannelId);
  if (!inbound) return fail(`inbound channel ${hop.inboundChannelId} not found`);
  const outbound = channels.get(hop.outboundChannelId);
  if (!outbound) return fail(`outbound channel ${hop.outboundChannelId} not found`);

  const inResult = validateChannelSpend(inbound, hop.from, hop.amountIn, hop.tokenIn);
  if (!inResult.ok) return inResult;

  const intermediary = otherParty(inbound, hop.from)?.publicKeyDigest;
  if (!intermediary) {
    return fail(`inbound channel ${hop.inboundChannelId} has no intermediary`);
  }
  if (!partyFor(outbound, hop.to)) {
    return fail(`recipient ${hop.to} is not a party on outbound channel ${hop.outboundChannelId}`);
  }
  const outIntermediary = otherParty(outbound, hop.to)?.publicKeyDigest;
  if (outIntermediary !== intermediary) {
    return fail(
      `swap intermediary mismatch: ${intermediary} != ${outIntermediary ?? 'none'}`,
    );
  }

  return validateChannelSpend(outbound, intermediary, hop.amountOut, hop.tokenOut);
}

/**
 * Validate that a route actually delivers the payment it was built for.
 *
 * Checks the properties per-hop validation cannot see:
 *  - the route is not empty;
 *  - it starts at the payer and ends at the recipient (when known);
 *  - consecutive hops connect (previous recipient is the next sender);
 *  - the asset being carried is the requested one at every hop, and a swap hop
 *    changes it exactly once (`tokenIn` → `tokenOut`);
 *  - the final hop delivers exactly the requested amount.
 *
 * Call this before `validateRoute`, so a structurally valid but wrong route is
 * rejected before any HTLC is locked.
 */
export function validateRouteForPayment(
  route:       Route,
  expectation: RoutePaymentExpectation,
): RouteValidationResult {
  if (route.hops.length === 0) {
    return fail('route has no hops');
  }
  if (route.tokenIn !== expectation.tokenId) {
    return fail(`route starts with token ${route.tokenIn}, payment is ${expectation.tokenId}`);
  }
  if (expectation.sender !== undefined) {
    const first = route.hops[0];
    if (first.from !== expectation.sender) {
      return fail(`route starts at ${first.from}, not at the payer ${expectation.sender}`);
    }
  }
  if (expectation.recipient !== undefined) {
    const last = route.hops[route.hops.length - 1];
    if (last.to !== expectation.recipient) {
      return fail(`route ends at ${last.to}, not at the recipient ${expectation.recipient}`);
    }
  }

  let token = route.tokenIn;
  let delivered: bigint | undefined;

  for (const [index, hop] of route.hops.entries()) {
    const previous = index > 0 ? route.hops[index - 1] : undefined;
    if (previous && previous.to !== hop.from) {
      return fail(
        `hop ${index} starts at ${hop.from} but hop ${index - 1} ends at ${previous.to}`,
      );
    }

    if ((hop as SwapHop).isSwap) {
      const swap = hop as SwapHop;
      if (swap.tokenIn !== token) {
        return fail(`swap hop ${index} expects ${swap.tokenIn} but the route carries ${token}`);
      }
      if (swap.tokenIn === swap.tokenOut) {
        return fail(`swap hop ${index} does not change the asset`);
      }
      if (swap.amountIn <= 0n || swap.amountOut <= 0n) {
        return fail(`swap hop ${index} has a non-positive amount`);
      }
      token = swap.tokenOut;
      delivered = swap.amountOut;
    } else {
      if (hop.tokenId !== token) {
        return fail(`hop ${index} carries ${hop.tokenId} but the route carries ${token}`);
      }
      if (hop.amount <= 0n) {
        return fail(`hop ${index} has a non-positive amount`);
      }
      delivered = hop.amount;
    }
  }

  if (route.tokenOut !== token) {
    return fail(`route declares tokenOut ${route.tokenOut} but ends carrying ${token}`);
  }
  if (token === expectation.tokenId && delivered !== expectation.amount) {
    return fail(
      `route delivers ${delivered?.toString() ?? 'nothing'} but the payment is `
      + expectation.amount.toString(),
    );
  }
  return { ok: true };
}

/** Convenience: bind a payment request to the route that is about to run. */
export function expectationFromRequest(request: PaymentRequest): RoutePaymentExpectation {
  return {
    tokenId: request.tokenId,
    amount: request.amount,
    ...(request.sender !== undefined ? { sender: request.sender } : {}),
    ...(request.recipient !== undefined ? { recipient: request.recipient } : {}),
  };
}

/** Validate every hop of a route against live channel state. */
export function validateRoute(
  channels: Map<string, RouterChannel>,
  route:    Route,
): RouteValidationResult {
  for (const hop of route.hops) {
    const result = (hop as SwapHop).isSwap
      ? validateSwapHop(channels, hop as SwapHop)
      : validateRoutingHop(channels, hop as RoutingHop);
    if (!result.ok) return result;
  }
  return { ok: true };
}
