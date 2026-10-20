import type { ChannelGraph, ChannelGraphEdge, SwapAnnouncement } from './types.js';
import { parseRateToScaled } from './rates.js';

/** Internal graph revisions (topology / economics / live state). */
export interface GraphRevisions {
  topology: number;
  economics: number;
  live: number;
}

const graphRevisions = new WeakMap<ChannelGraph, GraphRevisions>();

function ensureRevisions(graph: ChannelGraph): GraphRevisions {
  let revisions = graphRevisions.get(graph);
  if (!revisions) {
    revisions = { topology: 0, economics: 0, live: 0 };
    graphRevisions.set(graph, revisions);
  }
  return revisions;
}

/** Snapshot-consistent revision marker for routing caches and trees. */
export function getGraphRevisions(graph: ChannelGraph): GraphRevisions {
  return { ...ensureRevisions(graph) };
}

function bumpTopology(graph: ChannelGraph): void {
  const revisions = ensureRevisions(graph);
  revisions.topology += 1;
  revisions.live += 1;
}

function bumpEconomics(graph: ChannelGraph): void {
  ensureRevisions(graph).economics += 1;
}

/** Create an empty ChannelGraph. */
export function createChannelGraph(): ChannelGraph {
  const graph: ChannelGraph = {
    nodeEdges:       new Map(),
    edgesByChannel:  new Map(),
    swapIndex:       new Map(),
  };
  graphRevisions.set(graph, { topology: 0, economics: 0, live: 0 });
  return graph;
}

/**
 * Add a directed channel edge to the graph.
 *
 * A single logical channel between two parties has two directed edges — one
 * per direction of flow.  Both may be added independently using the same
 * `channelId` because they are keyed by `(channelId, from)`.  Calling
 * `addChannel` twice with the same `(channelId, from)` replaces the first
 * entry (balance update semantics).
 */
export function addChannel(graph: ChannelGraph, edge: ChannelGraphEdge): void {
  if (!edge.channelId || !edge.from || !edge.to || !edge.tokenId) {
    throw new Error('addChannel requires non-empty channelId, from, to and tokenId');
  }
  if (edge.feeRate < 0n) {
    throw new Error(
      `Invalid feeRate ${edge.feeRate.toString()} for channel ${edge.channelId}: must be non-negative`,
    );
  }
  if (edge.availableBalance < 0n) {
    throw new Error(
      `Invalid availableBalance ${edge.availableBalance.toString()} for channel ${edge.channelId}: must be non-negative`,
    );
  }
  if (edge.htlcCapacity < 0n) {
    throw new Error(
      `Invalid htlcCapacity ${edge.htlcCapacity.toString()} for channel ${edge.channelId}: must be non-negative`,
    );
  }

  const existing = graph.edgesByChannel.get(edge.channelId) ?? [];

  // Replace any edge for the same (channelId, from) direction.
  const idx = existing.findIndex(e => e.from === edge.from);
  if (idx >= 0) {
    _removeFromNodeEdges(graph, existing[idx]);
    existing.splice(idx, 1, edge);
  } else {
    existing.push(edge);
  }
  graph.edgesByChannel.set(edge.channelId, existing);

  // Register in nodeEdges for O(1) Dijkstra lookup.
  const nodeList = graph.nodeEdges.get(edge.from) ?? [];
  nodeList.push(edge);
  graph.nodeEdges.set(edge.from, nodeList);
  bumpTopology(graph);
}

/**
 * Remove ALL directed edges for `channelId` (i.e. both directions).
 * No-op if the channelId is not present.
 */
export function removeChannel(graph: ChannelGraph, channelId: string): void {
  const edges = graph.edgesByChannel.get(channelId);
  if (!edges) return;
  for (const edge of edges) {
    _removeFromNodeEdges(graph, edge);
  }
  graph.edgesByChannel.delete(channelId);
  bumpTopology(graph);
}

function _removeFromNodeEdges(graph: ChannelGraph, edge: ChannelGraphEdge): void {
  const nodeList = graph.nodeEdges.get(edge.from);
  if (!nodeList) return;
  const filtered = nodeList.filter(e => !(e.channelId === edge.channelId && e.from === edge.from));
  if (filtered.length === 0) {
    graph.nodeEdges.delete(edge.from);
  } else {
    graph.nodeEdges.set(edge.from, filtered);
  }
}

/**
 * Register a swap announcement from a bridging intermediary.
 *
 * Validates that the rate is a positive finite decimal before storing.
 * Throws `Error` if the rate is zero or negative.
 *
 * Duplicate announcements (same `intermediaryPubKey` + `inboundChannelId`)
 * are replaced to prevent stale rate data.
 */
export function announceSwap(graph: ChannelGraph, announcement: SwapAnnouncement): void {
  const rateScaled = parseRateToScaled(announcement.rate);
  if (rateScaled <= 0n) {
    throw new Error(
      `Invalid swap rate "${announcement.rate}" from intermediary ${announcement.intermediaryPubKey}: rate must be positive`,
    );
  }

  const key  = _swapKey(announcement.tokenIn, announcement.tokenOut);
  const list = graph.swapIndex.get(key) ?? [];
  const idx  = list.findIndex(
    a => a.intermediaryPubKey === announcement.intermediaryPubKey &&
         a.inboundChannelId   === announcement.inboundChannelId,
  );
  if (idx >= 0) {
    list[idx] = announcement;
  } else {
    list.push(announcement);
  }
  graph.swapIndex.set(key, list);
  bumpEconomics(graph);
}

/**
 * Return all swap announcements for a given token pair, or an empty array.
 */
export function getSwapAnnouncements(
  graph:    ChannelGraph,
  tokenIn:  string,
  tokenOut: string,
): SwapAnnouncement[] {
  return graph.swapIndex.get(_swapKey(tokenIn, tokenOut)) ?? [];
}

function _swapKey(tokenIn: string, tokenOut: string): string {
  return `${tokenIn}:${tokenOut}`;
}
