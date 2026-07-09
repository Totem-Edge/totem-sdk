import type { ChannelGraph, ChannelGraphEdge, SwapAnnouncement } from './types.js';
import { parseRateToScaled } from './pathfind.js';

/** Create an empty ChannelGraph. */
export function createChannelGraph(): ChannelGraph {
  return {
    nodeEdges:       new Map(),
    edgesByChannel:  new Map(),
    swapIndex:       new Map(),
  };
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
