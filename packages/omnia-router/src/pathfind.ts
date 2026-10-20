import type {
  ChannelGraph,
  Route,
  CrossTokenRoute,
  RoutingHop,
  SwapHop,
  RouteOptions,
} from './types.js';
import { getSwapAnnouncements } from './graph.js';
import { applyRate, parseRateToScaled } from './rates.js';
import { defaultEdgeFee as edgeFee, edgeKey } from './bounded-search.js';
import {
  createRoutingGraphSnapshot,
  selectRoutingEngine,
  FIXED_AMOUNT_COST_MODEL,
  DEFAULT_MAX_HOPS,
  type RoutingTree,
} from './routing-engine.js';

export { parseRateToScaled, applyRate };

// ─── Single-token ─────────────────────────────────────────────────────────────

/**
 * Find the cheapest route (lowest total fee, then fewest hops) from `from` to
 * `to` carrying `amount` of `tokenId`. Edges are filtered by tokenId and
 * availableBalance. Returns null if no path exists within maxHops.
 *
 * Delegates to the routing engine (zero-fee BFS / layered bounded search).
 */
export function findRoute(
  graph:   ChannelGraph,
  from:    string,
  to:      string,
  amount:  bigint,
  tokenId: string,
  opts?:   RouteOptions,
): Route | null {
  const snapshot = createRoutingGraphSnapshot(graph);
  const engine = selectRoutingEngine(snapshot);
  return engine.findRoute(
    snapshot,
    {
      source: from,
      destination: to,
      amount,
      tokenId,
      ...(opts?.maxHops === undefined ? {} : { maxHops: opts.maxHops }),
    },
    FIXED_AMOUNT_COST_MODEL,
  );
}

// ─── Cross-token ──────────────────────────────────────────────────────────────

/**
 * Find a cross-token route where the sender spends `tokenIn` and the
 * recipient receives `tokenOut`. The path may include one or more swap hops
 * provided by bridging intermediaries registered via announceSwap.
 *
 * Selection criteria: lowest total fee (including swap fee), then fewest hops,
 * then fewest swap hops, then a deterministic route key.
 *
 * `maxHops` is a **global** end-to-end budget: preHops + 1 (swap) + postHops
 * must not exceed it (RFC-055 §2.5). The inbound leg is computed once for all
 * announcements; the outbound leg is cached per `(postDst, amountOut, tokenOut)`.
 */
export function findCrossTokenRoute(
  graph:    ChannelGraph,
  from:     string,
  to:       string,
  amountIn: bigint,
  tokenIn:  string,
  tokenOut: string,
  opts?:    RouteOptions,
): CrossTokenRoute | null {
  const announcements = getSwapAnnouncements(graph, tokenIn, tokenOut);
  if (announcements.length === 0) return null;

  const maxHops = opts?.maxHops ?? DEFAULT_MAX_HOPS;
  if (!Number.isInteger(maxHops) || maxHops < 0) {
    throw new Error(`maxHops must be a non-negative integer (got ${String(opts?.maxHops)})`);
  }
  // A swap consumes one hop; pre + swap + post must fit the global budget.
  if (amountIn <= 0n || maxHops < 1) return null;

  const snapshot = createRoutingGraphSnapshot(graph);
  const engine = selectRoutingEngine(snapshot);

  // One bounded inbound tree serves every announcement.
  const preTree = engine.computeTree(
    snapshot,
    { source: from, amount: amountIn, tokenId: tokenIn, maxHops: maxHops - 1 },
    FIXED_AMOUNT_COST_MODEL,
  );
  const postCache = new Map<string, RoutingTree>();

  let best: CrossTokenRoute | null = null;

  for (const ann of announcements) {
    if (amountIn > ann.maxAmountIn) continue;

    const inboundEdges = graph.edgesByChannel.get(ann.inboundChannelId) ?? [];
    const inboundEdge = inboundEdges.find(
      e => e.to === ann.intermediaryPubKey && e.tokenId === tokenIn,
    );
    if (!inboundEdge) continue;
    if (inboundEdge.availableBalance < amountIn) continue;

    const amountOut = applyRate(amountIn, ann.rate);
    if (amountOut <= 0n) continue;

    const outboundEdges = graph.edgesByChannel.get(ann.outboundChannelId) ?? [];
    const outboundEdge = outboundEdges.find(
      e => e.from === ann.intermediaryPubKey && e.tokenId === tokenOut,
    );
    if (!outboundEdge) continue;
    if (outboundEdge.availableBalance < amountOut) continue;

    const preSrc  = inboundEdge.from;
    const postDst = outboundEdge.to;

    const postKey = `${postDst}|${amountOut.toString()}|${tokenOut}|${maxHops - 1}`;
    let postTree = postCache.get(postKey);
    if (!postTree) {
      postTree = engine.computeTree(
        snapshot,
        { source: postDst, amount: amountOut, tokenId: tokenOut, maxHops: maxHops - 1 },
        FIXED_AMOUNT_COST_MODEL,
      );
      postCache.set(postKey, postTree);
    }

    const inboundFee  = edgeFee(amountIn,  inboundEdge);
    const outboundFee = edgeFee(amountOut, outboundEdge);

    const swapHop: SwapHop = {
      isSwap:            true,
      channelId:         ann.inboundChannelId,
      from:              preSrc,
      to:                postDst,
      amount:            amountIn,
      tokenId:           tokenIn,
      tokenIn,
      tokenOut,
      amountIn,
      amountOut,
      rate:              ann.rate,
      inboundChannelId:  ann.inboundChannelId,
      outboundChannelId: ann.outboundChannelId,
    };

    for (let preH = 0; preH <= maxHops - 1; preH++) {
      const preLabel = preTree.labelAt(preSrc, preH);
      if (!preLabel) continue;

      for (let postH = 0; postH <= maxHops - 1 - preH; postH++) {
        const postLabel = postTree.labelAt(to, postH);
        if (!postLabel) continue;

        const allHops: (RoutingHop | SwapHop)[] = [
          ...preLabel.route.hops,
          swapHop,
          ...postLabel.route.hops,
        ];

        const candidate: CrossTokenRoute = {
          hops: allHops,
          totalFees: preLabel.totalFees + inboundFee + outboundFee + postLabel.totalFees,
          tokenIn,
          tokenOut,
          estimatedBlocks: allHops.length * 2,
          swapHops: [swapHop],
        };

        if (!best || _crossTokenBetter(candidate, best)) {
          best = candidate;
        }
      }
    }
  }

  return best;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _crossTokenBetter(a: CrossTokenRoute, b: CrossTokenRoute): boolean {
  if (a.totalFees !== b.totalFees) return a.totalFees < b.totalFees;
  if (a.hops.length !== b.hops.length) return a.hops.length < b.hops.length;
  if (a.swapHops.length !== b.swapHops.length) return a.swapHops.length < b.swapHops.length;
  return _routeKey(a.hops) < _routeKey(b.hops);
}

function _routeKey(hops: (RoutingHop | SwapHop)[]): string {
  return hops.map((hop) => {
    if ((hop as SwapHop).isSwap) {
      const swap = hop as SwapHop;
      return `swap:${swap.channelId}:${swap.outboundChannelId}`;
    }
    return edgeKey(hop as RoutingHop);
  }).join('>');
}
