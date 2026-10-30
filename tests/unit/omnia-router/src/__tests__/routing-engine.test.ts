import { addChannel, announceSwap, createChannelGraph, getGraphRevisions, removeChannel } from '../graph.js';
import { findRoute } from '../pathfind.js';
import {
  FIXED_AMOUNT_COST_MODEL,
  UnsupportedRoutingModeError,
  createRoutingGraphSnapshot,
  routeCacheKey,
  selectRoutingEngine,
  type RoutingCostModel,
} from '../routing-engine.js';
import type { ChannelGraph, ChannelGraphEdge } from '../types.js';

const SCALE = 100_000_000n;
const TOKEN = '0x' + 'aa'.repeat(32);

function edge(
  channelId: string,
  from: string,
  to: string,
  feeRate: bigint,
  balance: bigint = 1_000_000n * SCALE,
): ChannelGraphEdge {
  return {
    channelId,
    from,
    to,
    tokenId: TOKEN,
    availableBalance: balance,
    htlcCapacity: balance,
    feeRate,
  };
}

function treeGraph(): ChannelGraph {
  const g = createChannelGraph();
  addChannel(g, edge('s-a', 'S', 'A', 1n));
  addChannel(g, edge('a-t', 'A', 'T', 1n));
  addChannel(g, edge('s-b', 'S', 'B', 2n));
  addChannel(g, edge('b-t', 'B', 'T', 2n));
  return g;
}

describe('routing engine (RFC-055 Phase 1)', () => {
  test('exposes bounded / one-to-many capabilities and rejects unbounded', () => {
    const snapshot = createRoutingGraphSnapshot(treeGraph());
    const engine = selectRoutingEngine(snapshot);

    expect(engine.capabilities).toMatchObject({
      bounded: true,
      unbounded: false,
      oneToMany: true,
      crossToken: true,
    });

    expect(() =>
      engine.findRoute(snapshot, {
        source: 'S',
        destination: 'T',
        amount: SCALE,
        tokenId: TOKEN,
        maxHops: null,
      }),
    ).toThrow(UnsupportedRoutingModeError);

    expect(() =>
      engine.computeTree(snapshot, {
        source: 'S',
        amount: SCALE,
        tokenId: TOKEN,
        maxHops: null,
      }),
    ).toThrow(UnsupportedRoutingModeError);
  });

  test('computeTree reconstructs routes on demand and matches findRoute', () => {
    const g = treeGraph();
    const snapshot = createRoutingGraphSnapshot(g);
    const engine = selectRoutingEngine(snapshot);

    const tree = engine.computeTree(snapshot, {
      source: 'S',
      amount: SCALE,
      tokenId: TOKEN,
      maxHops: 8,
    });

    expect(tree.destinations).toEqual(['A', 'B', 'S', 'T']);
    expect(tree.costModelId).toBe(FIXED_AMOUNT_COST_MODEL.id);
    expect(tree.revision).toEqual(snapshot.revision);

    expect(tree.routeTo('T')).toEqual(findRoute(g, 'S', 'T', SCALE, TOKEN, { maxHops: 8 }));
    expect(tree.routeTo('A')!.totalFees).toBe(1n);

    expect(tree.labelAt('T', 1)).toBeNull();
    const twoHop = tree.labelAt('T', 2);
    expect(twoHop).not.toBeNull();
    expect(twoHop!.totalFees).toBe(2n);
    expect(twoHop!.route.hops).toHaveLength(2);
  });

  test('zero-fee trees use BFS layers (shortest-hop labels)', () => {
    const g = createChannelGraph();
    addChannel(g, edge('s-t', 'S', 'T', 0n));
    addChannel(g, edge('s-a', 'S', 'A', 0n));
    addChannel(g, edge('a-t', 'A', 'T', 0n));

    const snapshot = createRoutingGraphSnapshot(g);
    const engine = selectRoutingEngine(snapshot);
    const tree = engine.computeTree(snapshot, {
      source: 'S',
      amount: SCALE,
      tokenId: TOKEN,
      maxHops: 8,
    });

    expect(tree.routeTo('T')!.hops).toHaveLength(1);
    expect(tree.labelAt('T', 1)).not.toBeNull();
    // A zero-fee BFS tree records only the shortest-hop label.
    expect(tree.labelAt('T', 2)).toBeNull();
  });

  test('honours a custom cost model', () => {
    const snapshot = createRoutingGraphSnapshot(treeGraph());
    const engine = selectRoutingEngine(snapshot);
    const flat: RoutingCostModel = {
      ...FIXED_AMOUNT_COST_MODEL,
      id: 'flat-7',
      edgeFee: () => 7n,
    };

    const tree = engine.computeTree(
      snapshot,
      { source: 'S', amount: SCALE, tokenId: TOKEN, maxHops: 8 },
      flat,
    );

    expect(tree.costModelId).toBe('flat-7');
    expect(tree.routeTo('T')!.totalFees).toBe(14n); // 2 hops × 7
    expect(FIXED_AMOUNT_COST_MODEL.edgeFee(SCALE, edge('x', 'S', 'T', 3n))).toBe(3n);
  });

  test('tracks topology / economics / live revisions', () => {
    const g = createChannelGraph();
    expect(getGraphRevisions(g)).toEqual({ topology: 0, economics: 0, live: 0 });

    addChannel(g, edge('c1', 'S', 'T', 0n));
    expect(getGraphRevisions(g)).toEqual({ topology: 1, economics: 0, live: 1 });

    announceSwap(g, {
      intermediaryPubKey: 'BRIDGE',
      tokenIn: TOKEN,
      tokenOut: '0x' + 'bb'.repeat(32),
      rate: '1',
      inboundChannelId: 'in',
      outboundChannelId: 'out',
      maxAmountIn: 1_000_000n * SCALE,
    });
    expect(getGraphRevisions(g)).toEqual({ topology: 1, economics: 1, live: 1 });

    removeChannel(g, 'c1');
    expect(getGraphRevisions(g)).toEqual({ topology: 2, economics: 1, live: 2 });
    expect(createRoutingGraphSnapshot(g).revision).toEqual(getGraphRevisions(g));
  });

  test('routeCacheKey includes query, revision and cost model', () => {
    const g = treeGraph();
    const snapshot = createRoutingGraphSnapshot(g);
    const query = {
      source: 'S',
      destination: 'T',
      amount: SCALE,
      tokenId: TOKEN,
      maxHops: 8,
    } as const;

    const base = routeCacheKey(snapshot, query);
    expect(routeCacheKey(snapshot, query)).toBe(base);
    expect(routeCacheKey(snapshot, { ...query, amount: SCALE + 1n })).not.toBe(base);
    expect(routeCacheKey(snapshot, { ...query, tokenId: '0x' + 'cc'.repeat(32) })).not.toBe(base);
    expect(routeCacheKey(snapshot, { ...query, maxHops: 4 })).not.toBe(base);
    expect(routeCacheKey(snapshot, query, { ...FIXED_AMOUNT_COST_MODEL, id: 'other' })).not.toBe(base);

    addChannel(g, edge('extra', 'S', 'T', 0n));
    const revised = createRoutingGraphSnapshot(g);
    expect(routeCacheKey(revised, query)).not.toBe(base);
  });
});
