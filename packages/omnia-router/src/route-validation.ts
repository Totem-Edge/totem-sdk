/**
 * Route revalidation against live channel state (RFC-054 §4 / RFC-055).
 *
 * A route from the router is a *candidate*. Before locking HTLCs the executor
 * must confirm the channels still exist, are active, carry the expected token,
 * have the expected direction and have enough sender balance.
 */
import type {
  ChannelParty,
  RouterChannel,
  RoutingHop,
  Route,
  SwapHop,
} from './types.js';

/**
 * What the route is supposed to do, expressed independently of the route object
 * (OMN-080). Without this a structurally valid route that pays nobody still
 * "passes" validation.
 */
export interface RouteBinding {
  /** Party the payment starts from. */
  payer?: string;
  /** Party the payment must reach. */
  recipient?: string;
  /** Amount the recipient must receive. */
  amount?: bigint;
  /** Asset the recipient must receive. */
  tokenId?: string;
}

function sameToken(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export type RouteValidationResult =
  | { ok: true }
  | { ok: false; error: string };

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
 * Validate a route against live channel state **and** against what the payment
 * is supposed to do (OMN-080).
 *
 * Per-hop checks answer "can this channel spend?". They do not answer "does
 * this route pay the right party the right amount?" — an empty route, a route
 * whose hops do not connect, or a route that delivers a different amount all
 * used to pass. `binding` supplies the intent; when it is omitted the route is
 * still required to be non-empty and internally consistent.
 */
export function validateRoute(
  channels: Map<string, RouterChannel>,
  route:    Route,
  binding:  RouteBinding = {},
): RouteValidationResult {
  if (!Array.isArray(route.hops) || route.hops.length === 0) {
    return fail('route has no hops');
  }

  for (const [index, hop] of route.hops.entries()) {
    const result = (hop as SwapHop).isSwap
      ? validateSwapHop(channels, hop as SwapHop)
      : validateRoutingHop(channels, hop as RoutingHop);
    if (!result.ok) return result;

    const next = route.hops[index + 1];
    if (next && hop.to !== next.from) {
      return fail(
        `route is disconnected between hops ${index} and ${index + 1}: `
        + `${hop.to} != ${next.from}`,
      );
    }
    if (next && sameToken(hop.tokenId, next.tokenId) === false) {
      // A token transition is only legitimate through an explicit swap hop.
      const swap = (hop as SwapHop).isSwap ? hop as SwapHop : (next as SwapHop).isSwap ? next as SwapHop : undefined;
      if (!swap) {
        return fail(
          `route changes asset between hops ${index} and ${index + 1} `
          + `(${hop.tokenId} -> ${next.tokenId}) without a swap`,
        );
      }
    }
  }

  const first = route.hops[0] as RoutingHop;
  const last = route.hops[route.hops.length - 1] as RoutingHop;

  if (binding.payer !== undefined && first.from !== binding.payer) {
    return fail(`route starts at ${first.from}, not at the payer ${binding.payer}`);
  }
  if (binding.recipient !== undefined && last.to !== binding.recipient) {
    return fail(`route ends at ${last.to}, not at the recipient ${binding.recipient}`);
  }
  if (binding.amount !== undefined) {
    const delivered = (last as SwapHop).isSwap ? (last as SwapHop).amountOut : last.amount;
    if (delivered !== binding.amount) {
      return fail(
        `route delivers ${delivered.toString()}, not the requested ${binding.amount.toString()}`,
      );
    }
  }
  if (binding.tokenId !== undefined) {
    const deliveredToken = (last as SwapHop).isSwap ? (last as SwapHop).tokenOut : last.tokenId;
    if (!sameToken(deliveredToken, binding.tokenId)) {
      return fail(`route delivers ${deliveredToken}, not the requested ${binding.tokenId}`);
    }
  }

  return { ok: true };
}
