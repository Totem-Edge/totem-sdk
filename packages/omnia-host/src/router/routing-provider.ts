import {
  createChannelGraph,
  findCrossTokenRoute,
  findRoute,
  type ChannelGraph,
  type ChannelGraphEdge,
  type CrossTokenRoute,
  type Route,
} from '@totemsdk/omnia-router';
import type { OmniaChannel } from '@totemsdk/omnia';

export interface RouteQuery {
  from: string;
  to: string;
  amount: bigint;
  tokenId: string;
  targetTokenId?: string;
  maxHops?: number;
}

export interface RoutingProvider {
  rebuild(edges: Iterable<ChannelGraphEdge>): void;
  getRoute(query: RouteQuery): Route | CrossTokenRoute | null | Promise<Route | CrossTokenRoute | null>;
}

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

/** Default in-process TypeScript routing engine. */
export class InProcessRoutingProvider implements RoutingProvider {
  private graph: ChannelGraph = createChannelGraph();

  rebuild(edges: Iterable<ChannelGraphEdge>): void {
    this.graph = createChannelGraph();
    for (const edge of edges) {
      const current = this.graph.edgesByChannel.get(edge.channelId) ?? [];
      const duplicate = current.findIndex((item) => item.from === edge.from);
      if (duplicate >= 0) current[duplicate] = edge;
      else current.push(edge);
      this.graph.edgesByChannel.set(edge.channelId, current);
      const nodeEdges = this.graph.nodeEdges.get(edge.from) ?? [];
      const nodeIndex = nodeEdges.findIndex((item) => item.channelId === edge.channelId && item.from === edge.from);
      if (nodeIndex >= 0) nodeEdges[nodeIndex] = edge;
      else nodeEdges.push(edge);
      this.graph.nodeEdges.set(edge.from, nodeEdges);
    }
  }

  getRoute(query: RouteQuery): Route | CrossTokenRoute | null {
    if (query.targetTokenId && query.targetTokenId !== query.tokenId) {
      return findCrossTokenRoute(
        this.graph,
        query.from,
        query.to,
        query.amount,
        query.tokenId,
        query.targetTokenId,
        { maxHops: query.maxHops },
      );
    }
    return findRoute(
      this.graph,
      query.from,
      query.to,
      query.amount,
      query.tokenId,
      { maxHops: query.maxHops },
    );
  }
}
