/**
 * Wallet-side routing for `@totemsdk/omnia-relay` (RFC-034 Phase A).
 *
 * `@totemsdk/omnia-router` is a dependency-clean, browser-safe graph/pathfinding
 * library (it imports only `@totemsdk/core` + `@totemsdk/storage`; its
 * `@totemsdk/omnia` peer is optional and never imported at runtime). This module
 * adapts the wallet's known channels into a `ChannelGraph` and exposes a
 * `RoutingPort` seam so a host can inject a fuller topology (own + announced).
 */

import {
  createChannelGraph,
  addChannel,
  announceSwap,
  findRoute,
  findCrossTokenRoute,
  getSwapAnnouncements,
  type ChannelGraph,
  type ChannelGraphEdge,
  type Route,
  type CrossTokenRoute,
  type SwapAnnouncement,
} from '@totemsdk/omnia-router';
import type { OmniaChannel } from '@totemsdk/omnia';

/**
 * Source of routing topology for the relay client (RFC-034 §6.1). A thin wallet
 * sees only its own channels, so a host (a self-hosted relay sidecar) or a
 * gossip feed may inject a fuller graph.
 */
export interface RoutingPort {
  /** Current known directed channel edges (own + announced). */
  snapshot(): Iterable<ChannelGraphEdge>;
  /** Optional: announced cross-token swaps. */
  swaps?(): readonly SwapAnnouncement[];
}

/** Derive directed graph edges from a set of Omnia channels (single-node view). */
export function channelGraphEdges(channels: Iterable<OmniaChannel>): ChannelGraphEdge[] {
  const edges: ChannelGraphEdge[] = [];
  for (const channel of channels) {
    if (channel.status === 'closed') continue;
    const [first, second] = channel.parties;
    if (!first || !second) continue;
    const pending = channel.pendingHTLCs
      .filter((htlc) => htlc.status === 'pending')
      .reduce((sum, htlc) => sum + htlc.amount, 0n);
    const capacity = channel.totalValue > pending ? channel.totalValue - pending : 0n;
    edges.push(
      {
        channelId: channel.channelId,
        from: first.publicKeyDigest,
        to: second.publicKeyDigest,
        tokenId: channel.tokenId,
        availableBalance: channel.balances[first.partyId] ?? 0n,
        htlcCapacity: capacity,
        feeRate: 0n,
      },
      {
        channelId: channel.channelId,
        from: second.publicKeyDigest,
        to: first.publicKeyDigest,
        tokenId: channel.tokenId,
        availableBalance: channel.balances[second.partyId] ?? 0n,
        htlcCapacity: capacity,
        feeRate: 0n,
      },
    );
  }
  return edges;
}

/**
 * Build a `ChannelGraph` from the injected routing source, or the wallet's own
 * channels when no source is configured.
 */
export function buildGraph(
  routing: RoutingPort | undefined,
  channels: Iterable<OmniaChannel>,
): ChannelGraph {
  const graph = createChannelGraph();
  const edges = routing ? routing.snapshot() : channelGraphEdges(channels);
  for (const edge of edges) addChannel(graph, edge);
  if (routing?.swaps) {
    for (const swap of routing.swaps()) announceSwap(graph, swap);
  }
  return graph;
}

export interface RouteQuery {
  from: string;
  to: string;
  amount: bigint;
  tokenId: string;
  targetTokenId?: string;
  maxHops?: number;
}

/** Pure routing query over a graph. Returns `null` when no route exists. */
export function queryRoute(graph: ChannelGraph, query: RouteQuery): Route | CrossTokenRoute | null {
  if (query.targetTokenId && query.targetTokenId !== query.tokenId) {
    return findCrossTokenRoute(
      graph,
      query.from,
      query.to,
      query.amount,
      query.tokenId,
      query.targetTokenId,
      { maxHops: query.maxHops },
    );
  }
  return findRoute(graph, query.from, query.to, query.amount, query.tokenId, { maxHops: query.maxHops });
}

/** Serialize a route for the wire (bigints → decimal strings). */
export function serializeRoute(route: Route | CrossTokenRoute): Record<string, unknown> {
  return {
    tokenIn: route.tokenIn,
    tokenOut: route.tokenOut,
    totalFees: route.totalFees.toString(),
    estimatedBlocks: route.estimatedBlocks,
    hops: route.hops.map((hop) => {
      const base = {
        channelId: hop.channelId,
        from: hop.from,
        to: hop.to,
        amount: hop.amount.toString(),
        tokenId: hop.tokenId,
      };
      if ('isSwap' in hop && hop.isSwap) {
        return {
          ...base,
          isSwap: true,
          tokenIn: hop.tokenIn,
          tokenOut: hop.tokenOut,
          amountIn: hop.amountIn.toString(),
          amountOut: hop.amountOut.toString(),
          rate: hop.rate,
          inboundChannelId: hop.inboundChannelId,
          outboundChannelId: hop.outboundChannelId,
        };
      }
      return base;
    }),
  };
}

/** Serialize swap announcements for the wire. */
export function serializeSwapAnnouncement(a: SwapAnnouncement): Record<string, unknown> {
  return {
    intermediaryPubKey: a.intermediaryPubKey,
    tokenIn: a.tokenIn,
    tokenOut: a.tokenOut,
    rate: a.rate,
    inboundChannelId: a.inboundChannelId,
    outboundChannelId: a.outboundChannelId,
    maxAmountIn: a.maxAmountIn.toString(),
  };
}

export { getSwapAnnouncements };
