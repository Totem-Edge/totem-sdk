/**
 * Bounded routing core (RFC-055 Phase 1).
 *
 * Internal module shared by the point-to-point engine, the one-to-many tree and
 * cross-token routing. Not exported from the package barrel yet.
 */
import type { ChannelGraph, ChannelGraphEdge, Route, RoutingHop } from './types.js';
import { SCALE } from './rates.js';

export type FeeFunction = (amount: bigint, edge: ChannelGraphEdge) => bigint;

/** Default cost model: amount × feeRate / SCALE, fixed amount per hop. */
export function defaultEdgeFee(amount: bigint, edge: ChannelGraphEdge): bigint {
  return (amount * edge.feeRate) / SCALE;
}

export interface SearchParent {
  prevNode: string;
  edge:     ChannelGraphEdge;
}

export interface SearchLabel {
  totalFees: bigint;
  parent?:   SearchParent;
}

/** Deterministic edge key used for tie-breaking and BFS ordering. */
export function edgeKey(edge: { channelId: string; from: string; to: string }): string {
  return `${edge.channelId}|${edge.from}|${edge.to}`;
}

/** Layered (hops, node) search. layers[h][v] is the cheapest path using exactly h edges. */
export function computeLayers(
  graph:    ChannelGraph,
  from:     string,
  amount:   bigint,
  tokenId:  string,
  maxHops:  number,
  feeFor:   FeeFunction = defaultEdgeFee,
): Array<Map<string, SearchLabel>> {
  const layers: Array<Map<string, SearchLabel>> =
    Array.from({ length: maxHops + 1 }, () => new Map<string, SearchLabel>());
  layers[0].set(from, { totalFees: 0n });

  for (let h = 1; h <= maxHops; h++) {
    const prev = layers[h - 1];
    if (prev.size === 0) break;
    const curr = layers[h];

    for (const [u, label] of prev) {
      const edges = graph.nodeEdges.get(u);
      if (!edges) continue;

      for (const edge of edges) {
        if (edge.tokenId !== tokenId) continue;
        if (edge.feeRate < 0n) continue;
        if (edge.availableBalance < amount) continue;

        const newFees = label.totalFees + feeFor(amount, edge);
        const parent: SearchParent = { prevNode: u, edge };
        const existing = curr.get(edge.to);

        if (!existing || _betterSameLayer(newFees, parent, existing, h, edge.to, layers)) {
          curr.set(edge.to, { totalFees: newFees, parent });
        }
      }
    }
  }

  return layers;
}

/** Select the cheapest (fees, hops) label for `to` and reconstruct its path. */
export function routeFromLayers(
  layers:  Array<Map<string, SearchLabel>>,
  to:      string,
  amount:  bigint,
  tokenId: string,
  maxHops: number,
): Route | null {
  let bestH = -1;
  let bestFees = 0n;
  for (let h = 0; h <= maxHops; h++) {
    const label = layers[h]?.get(to);
    if (!label) continue;
    if (
      bestH === -1 ||
      label.totalFees < bestFees ||
      (label.totalFees === bestFees && h < bestH)
    ) {
      bestH = h;
      bestFees = label.totalFees;
    }
  }
  if (bestH === -1) return null;

  const hops = reconstructFromLayers(layers, bestH, to, amount, tokenId);
  return {
    hops,
    totalFees: bestFees,
    tokenIn:  tokenId,
    tokenOut: tokenId,
    estimatedBlocks: hops.length * 2,
  };
}

export function reconstructFromLayers(
  layers:  Array<Map<string, SearchLabel>>,
  h:       number,
  to:      string,
  amount:  bigint,
  tokenId: string,
): RoutingHop[] {
  const hops: RoutingHop[] = [];
  let current = to;
  for (let layer = h; layer > 0; layer--) {
    const label = layers[layer]?.get(current);
    if (!label?.parent) break;
    const { edge } = label.parent;
    hops.push({
      channelId: edge.channelId,
      from:      edge.from,
      to:        edge.to,
      amount,
      tokenId,
      feeRate:   edge.feeRate,
    });
    current = label.parent.prevNode;
  }
  return hops.reverse();
}

/** True when every edge for `tokenId` costs zero under `feeFor` (BFS is optimal). */
export function isZeroFeeToken(
  graph:   ChannelGraph,
  tokenId: string,
  amount:  bigint,
  feeFor:  FeeFunction = defaultEdgeFee,
): boolean {
  // Fast path for the fixed-amount model: avoid per-edge bigint math.
  const fast = feeFor === defaultEdgeFee;
  for (const edges of graph.nodeEdges.values()) {
    for (const edge of edges) {
      if (edge.tokenId !== tokenId) continue;
      const zero = fast ? edge.feeRate === 0n : feeFor(amount, edge) === 0n;
      if (!zero) return false;
    }
  }
  return true;
}

/** Bounded BFS for zero-fee single-token graphs (fewest hops, deterministic). */
/** BFS layer tree for zero-fee single-token graphs (shortest-hop labels). */
export function bfsLayers(
  graph:    ChannelGraph,
  from:     string,
  amount:   bigint,
  tokenId:  string,
  maxHops:  number,
  stopAt?:  string,
): Array<Map<string, SearchLabel>> {
  const layers: Array<Map<string, SearchLabel>> =
    Array.from({ length: maxHops + 1 }, () => new Map<string, SearchLabel>());
  layers[0].set(from, { totalFees: 0n });

  const visited = new Set<string>([from]);
  let frontier: string[] = [from];

  for (let depth = 1; depth <= maxHops && frontier.length > 0; depth++) {
    const next: string[] = [];
    const layer = layers[depth];
    for (const u of frontier) {
      const edges = [...(graph.nodeEdges.get(u) ?? [])].sort(_compareEdges);
      for (const edge of edges) {
        if (edge.tokenId !== tokenId) continue;
        if (edge.feeRate < 0n) continue;
        if (edge.availableBalance < amount) continue;
        if (visited.has(edge.to)) continue;

        visited.add(edge.to);
        layer.set(edge.to, { totalFees: 0n, parent: { prevNode: u, edge } });
        if (stopAt !== undefined && edge.to === stopAt) return layers;
        next.push(edge.to);
      }
    }
    frontier = next;
  }

  return layers;
}

/** Bounded BFS for zero-fee single-token graphs (fewest hops, deterministic). */
export function bfsRoute(
  graph:    ChannelGraph,
  from:     string,
  to:       string,
  amount:   bigint,
  tokenId:  string,
  maxHops:  number,
): Route | null {
  return routeFromLayers(
    bfsLayers(graph, from, amount, tokenId, maxHops, to),
    to,
    amount,
    tokenId,
    maxHops,
  );
}

function _betterSameLayer(
  newFees:  bigint,
  parent:   SearchParent,
  existing: SearchLabel,
  h:        number,
  node:     string,
  layers:   Array<Map<string, SearchLabel>>,
): boolean {
  if (newFees !== existing.totalFees) return newFees < existing.totalFees;
  return _parentKey(parent, h - 1, layers) < _pathKey(h, node, layers);
}

function _pathKey(
  h:      number,
  node:   string,
  layers: Array<Map<string, SearchLabel>>,
): string {
  const parts: string[] = [];
  let current = node;
  for (let layer = h; layer > 0; layer--) {
    const label = layers[layer]?.get(current);
    if (!label?.parent) break;
    parts.push(edgeKey(label.parent.edge));
    current = label.parent.prevNode;
  }
  return parts.reverse().join('>');
}

function _parentKey(
  parent: SearchParent,
  hPrev:  number,
  layers: Array<Map<string, SearchLabel>>,
): string {
  const prefix = edgeKey(parent.edge);
  const rest = hPrev === 0 ? '' : _pathKey(hPrev, parent.prevNode, layers);
  return rest ? `${prefix}>${rest}` : prefix;
}

function _compareEdges(a: ChannelGraphEdge, b: ChannelGraphEdge): number {
  const ka = edgeKey(a);
  const kb = edgeKey(b);
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}
