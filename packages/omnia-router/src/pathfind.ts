import type {
  ChannelGraph,
  ChannelGraphEdge,
  Route,
  CrossTokenRoute,
  RoutingHop,
  SwapHop,
  RouteOptions,
} from './types.js';
import { getSwapAnnouncements } from './graph.js';

const SCALE = 100_000_000n;

// ─── Numeric helpers ──────────────────────────────────────────────────────────

/**
 * Parse a decimal rate string to a scaled bigint (SCALE = 10^8).
 * "0.95" → 95_000_000n, "1.5" → 150_000_000n, "2" → 200_000_000n.
 */
export function parseRateToScaled(rate: string): bigint {
  const neg = rate.startsWith('-');
  const abs = neg ? rate.slice(1) : rate;
  const dot = abs.indexOf('.');
  const intPart  = dot === -1 ? abs : (abs.slice(0, dot) || '0');
  const fracFull = dot === -1 ? '' : abs.slice(dot + 1);
  const fracStr  = fracFull.slice(0, 8).padEnd(8, '0');
  const ninth    = fracFull.length > 8 ? parseInt(fracFull[8] ?? '0', 10) : 0;
  const result   = BigInt(intPart) * SCALE + BigInt(fracStr) + (ninth >= 5 ? 1n : 0n);
  return neg ? -result : result;
}

/** Apply rate to amount: amountOut = amountIn × rateScaled / SCALE */
export function applyRate(amountIn: bigint, rate: string): bigint {
  const rateScaled = parseRateToScaled(rate);
  return (amountIn * rateScaled) / SCALE;
}

// ─── Single-token Dijkstra ────────────────────────────────────────────────────

type DijkstraState = {
  node:       string;
  totalFees:  bigint;
  hops:       number;
  path:       RoutingHop[];
};

/**
 * Find the cheapest route (lowest total fee, then fewest hops) from `from` to
 * `to` carrying `amount` of `tokenId`.  Edges are filtered by tokenId and
 * availableBalance.
 *
 * Returns null if no path exists within maxHops.
 */
export function findRoute(
  graph:   ChannelGraph,
  from:    string,
  to:      string,
  amount:  bigint,
  tokenId: string,
  opts?:   RouteOptions,
): Route | null {
  return _reconstruct(graph, from, to, amount, tokenId, opts?.maxHops ?? 8);
}

/** Full path reconstruction (used once Dijkstra confirms a route exists). */
function _reconstruct(
  graph:   ChannelGraph,
  from:    string,
  to:      string,
  amount:  bigint,
  tokenId: string,
  maxHops: number,
): Route | null {
  const dist  = new Map<string, { totalFees: bigint; hops: number; path: RoutingHop[] }>();
  const queue: DijkstraState[] = [{ node: from, totalFees: 0n, hops: 0, path: [] }];
  dist.set(from, { totalFees: 0n, hops: 0, path: [] });

  while (queue.length > 0) {
    const { node, totalFees, hops, path } = _dequeue(queue);

    if (node === to) {
      return {
        hops: path,
        totalFees,
        tokenIn:         tokenId,
        tokenOut:        tokenId,
        estimatedBlocks: path.length * 2,
      };
    }

    if (hops >= maxHops) continue;

    for (const edge of (graph.nodeEdges.get(node) ?? [])) {
      if (edge.tokenId         !== tokenId) continue;
      if (edge.availableBalance < amount)   continue;

      const fee     = _edgeFee(amount, edge);
      const newFees = totalFees + fee;
      const newHops = hops + 1;

      const best = dist.get(edge.to);
      if (best && _notBetter(newFees, newHops, best.totalFees, best.hops)) continue;

      const hop: RoutingHop = {
        channelId: edge.channelId,
        from:      edge.from,
        to:        edge.to,
        amount,
        tokenId,
      };
      const newPath = [...path, hop];
      dist.set(edge.to, { totalFees: newFees, hops: newHops, path: newPath });
      _enqueue(queue, { node: edge.to, totalFees: newFees, hops: newHops, path: newPath });
    }
  }

  const best = dist.get(to);
  if (!best) return null;
  return {
    hops: best.path,
    totalFees: best.totalFees,
    tokenIn:         tokenId,
    tokenOut:        tokenId,
    estimatedBlocks: best.path.length * 2,
  };
}

// ─── Cross-token Dijkstra ─────────────────────────────────────────────────────

/**
 * Find a cross-token route where the sender spends `tokenIn` and the
 * recipient receives `tokenOut`.  The path may include one or more swap hops
 * provided by bridging intermediaries registered via announceSwap.
 *
 * Selection criteria: lowest total fee (including swap fee), then fewest hops,
 * then fewest swap hops.
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

  let best: CrossTokenRoute | null = null;

  for (const ann of announcements) {
    // Validate maxAmountIn
    if (amountIn > ann.maxAmountIn) continue;

    // Inbound segment: from → intermediary via tokenIn.
    // Look up the directed edge whose `to` is the intermediary (the edge ends
    // at the intermediary so they can claim the inbound HTLC).
    const inboundEdges = graph.edgesByChannel.get(ann.inboundChannelId) ?? [];
    const inboundEdge = inboundEdges.find(
      e => e.to === ann.intermediaryPubKey && e.tokenId === tokenIn,
    );
    if (!inboundEdge) continue;

    // Check the inbound edge has sufficient balance
    if (inboundEdge.availableBalance < amountIn) continue;

    // amountOut from rate — must be positive (validated at announceSwap, but
    // guard here defensively in case of adversarial state or direct graph edits)
    const amountOut = applyRate(amountIn, ann.rate);
    if (amountOut <= 0n) continue;

    // Outbound segment: intermediary → recipient via tokenOut.
    // Look up the directed edge whose `from` is the intermediary.
    const outboundEdges = graph.edgesByChannel.get(ann.outboundChannelId) ?? [];
    const outboundEdge = outboundEdges.find(
      e => e.from === ann.intermediaryPubKey && e.tokenId === tokenOut,
    );
    if (!outboundEdge) continue;
    if (outboundEdge.availableBalance < amountOut) continue;

    // SwapHop represents the ENTIRE atomic bridge crossing — both the inbound
    // and outbound channels are locked together with the same hashlock inside
    // executeCrossTokenPayment.  We must NOT also include those channels as
    // ordinary RoutingHops, or execution would try to lock them twice.
    //
    // Therefore:
    //   pre-swap  = route from `from`          → inboundEdge.from
    //   post-swap = route from outboundEdge.to  → `to`
    //
    // Fees for the swap channels themselves (inboundFee + outboundFee) are
    // accounted for separately and NOT included in pre/post route totals.

    const preSrc  = inboundEdge.from;   // sender side of the inbound channel
    const postDst = outboundEdge.to;    // receiver side of the outbound channel

    // Pre-swap route: from → preSrc (empty when from IS the inbound channel sender)
    let preRoute: Route | null;
    if (from === preSrc) {
      preRoute = { hops: [], totalFees: 0n, tokenIn, tokenOut: tokenIn, estimatedBlocks: 0 };
    } else {
      preRoute = findRoute(graph, from, preSrc, amountIn, tokenIn, opts);
    }
    if (!preRoute) continue;

    // Post-swap route: postDst → to (empty when postDst IS the final recipient)
    let postRoute: Route | null;
    if (postDst === to) {
      postRoute = { hops: [], totalFees: 0n, tokenIn: tokenOut, tokenOut, estimatedBlocks: 0 };
    } else {
      postRoute = findRoute(graph, postDst, to, amountOut, tokenOut, opts);
    }
    if (!postRoute) continue;

    // Build the swap hop (encompasses both swap channels)
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

    // Fees: pre + inbound swap channel + outbound swap channel + post
    // (no double-counting — swap channels are NOT in preRoute/postRoute hops)
    const inboundFee  = _edgeFee(amountIn,  inboundEdge);
    const outboundFee = _edgeFee(amountOut, outboundEdge);
    const totalFees   = preRoute.totalFees + inboundFee + outboundFee + postRoute.totalFees;

    const allHops: (RoutingHop | SwapHop)[] = [
      ...preRoute.hops,
      swapHop,
      ...postRoute.hops,
    ];

    const candidate: CrossTokenRoute = {
      hops:            allHops,
      totalFees,
      tokenIn,
      tokenOut,
      estimatedBlocks: allHops.length * 2,
      swapHops:        [swapHop],
    };

    if (!best || _crossTokenBetter(candidate, best)) {
      best = candidate;
    }
  }

  return best;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _edgeFee(amount: bigint, edge: ChannelGraphEdge): bigint {
  return (amount * edge.feeRate) / SCALE;
}

/** Returns true if (newFees, newHops) is NOT better than (bestFees, bestHops). */
function _notBetter(
  newFees: bigint, newHops: number,
  bestFees: bigint, bestHops: number,
): boolean {
  if (newFees > bestFees)  return true;
  if (newFees < bestFees)  return false;
  return newHops >= bestHops;
}

function _crossTokenBetter(a: CrossTokenRoute, b: CrossTokenRoute): boolean {
  if (a.totalFees < b.totalFees) return true;
  if (a.totalFees > b.totalFees) return false;
  if (a.hops.length < b.hops.length) return true;
  if (a.hops.length > b.hops.length) return false;
  return a.swapHops.length < b.swapHops.length;
}

/** Extract a single-edge route when `from` → `to` via `edge` is a direct hop. */
function _singleEdgeRoute(
  edge:    ChannelGraphEdge,
  from:    string,
  to:      string,
  amount:  bigint,
  tokenId: string,
): Route | null {
  if (edge.from !== from || edge.to !== to) return null;
  if (edge.tokenId !== tokenId)             return null;
  if (edge.availableBalance < amount)       return null;
  const hop: RoutingHop = { channelId: edge.channelId, from, to, amount, tokenId };
  return { hops: [hop], totalFees: _edgeFee(amount, edge), tokenIn: tokenId, tokenOut: tokenId, estimatedBlocks: 2 };
}

/** Dequeue the minimum-cost state from the priority queue. */
function _dequeue(queue: DijkstraState[]): DijkstraState {
  let minIdx = 0;
  for (let i = 1; i < queue.length; i++) {
    const a = queue[i], b = queue[minIdx];
    if (a.totalFees < b.totalFees || (a.totalFees === b.totalFees && a.hops < b.hops)) {
      minIdx = i;
    }
  }
  return queue.splice(minIdx, 1)[0];
}

function _enqueue(queue: DijkstraState[], state: DijkstraState): void {
  queue.push(state);
}
