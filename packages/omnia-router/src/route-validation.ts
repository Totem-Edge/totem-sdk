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
