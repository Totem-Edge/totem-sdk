import { addChannel, announceSwap, createChannelGraph } from '../graph.js';
import { findCrossTokenRoute, findRoute } from '../pathfind.js';
import type { ChannelGraph, ChannelGraphEdge } from '../types.js';

const SCALE = 100_000_000n;
const TOKEN = '0x' + 'aa'.repeat(32);
const TOKEN_B = '0x' + 'bb'.repeat(32);

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

function channelIds(route: { hops: Array<{ channelId: string }> }): string[] {
  return route.hops.map((hop) => hop.channelId);
}

describe('bounded hop-constrained search', () => {
  test('keeps a higher-fee, fewer-hop label that can be extended within maxHops', () => {
    const g = createChannelGraph();
    // Low-fee path to X: 4 hops, fee 2.
    addChannel(g, edge('s-a1', 'S', 'A1', 0n));
    addChannel(g, edge('a1-a2', 'A1', 'A2', 0n));
    addChannel(g, edge('a2-a3', 'A2', 'A3', 0n));
    addChannel(g, edge('a3-x', 'A3', 'X', 2n));
    // High-fee path to X: 2 hops, fee 3.
    addChannel(g, edge('s-b1', 'S', 'B1', 1n));
    addChannel(g, edge('b1-x', 'B1', 'X', 2n));
    // Target needs 2 more hops from X.
    addChannel(g, edge('x-t1', 'X', 'T1', 0n));
    addChannel(g, edge('t1-t', 'T1', 'T', 0n));

    // maxHops = 5: only the 2-hop path to X leaves room for X→T.
    const bounded = findRoute(g, 'S', 'T', SCALE, TOKEN, { maxHops: 5 });
    expect(bounded).not.toBeNull();
    expect(bounded!.totalFees).toBe(3n);
    expect(bounded!.hops).toHaveLength(4);
    expect(channelIds(bounded!)).toEqual(['s-b1', 'b1-x', 'x-t1', 't1-t']);

    // maxHops = 6: the cheaper 4-hop path to X is now feasible.
    const longerBudget = findRoute(g, 'S', 'T', SCALE, TOKEN, { maxHops: 6 });
    expect(longerBudget).not.toBeNull();
    expect(longerBudget!.totalFees).toBe(2n);
    expect(longerBudget!.hops).toHaveLength(6);
  });

  test('respects maxHops', () => {
    const g = createChannelGraph();
    addChannel(g, edge('s-a', 'S', 'A', 0n));
    addChannel(g, edge('a-t', 'A', 'T', 0n));

    expect(findRoute(g, 'S', 'T', SCALE, TOKEN, { maxHops: 1 })).toBeNull();
    const route = findRoute(g, 'S', 'T', SCALE, TOKEN, { maxHops: 2 });
    expect(route).not.toBeNull();
    expect(route!.hops).toHaveLength(2);
  });

  test('prefers fewest hops when all fees are zero', () => {
    const g = createChannelGraph();
    addChannel(g, edge('s-t', 'S', 'T', 0n));
    addChannel(g, edge('s-a', 'S', 'A', 0n));
    addChannel(g, edge('a-t', 'A', 'T', 0n));

    const route = findRoute(g, 'S', 'T', SCALE, TOKEN, { maxHops: 8 });
    expect(route).not.toBeNull();
    expect(route!.totalFees).toBe(0n);
    expect(channelIds(route!)).toEqual(['s-t']);
  });

  test('breaks equal-cost ties deterministically, independent of insertion order', () => {
    const build = (reverse: boolean): ChannelGraph => {
      const g = createChannelGraph();
      const edges = [
        edge('a1', 'S', 'A', 0n),
        edge('a2', 'A', 'T', 0n),
        edge('b1', 'S', 'B', 0n),
        edge('b2', 'B', 'T', 0n),
      ];
      for (const e of reverse ? [...edges].reverse() : edges) addChannel(g, e);
      return g;
    };

    const first = findRoute(build(false), 'S', 'T', SCALE, TOKEN, { maxHops: 4 });
    const second = findRoute(build(true), 'S', 'T', SCALE, TOKEN, { maxHops: 4 });
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(channelIds(first!)).toEqual(['a1', 'a2']);
    expect(channelIds(second!)).toEqual(['a1', 'a2']);
  });
});

describe('routing validation', () => {
  test('rejects negative fees and balances at insertion', () => {
    const g = createChannelGraph();
    expect(() => addChannel(g, edge('neg-fee', 'S', 'T', -1n))).toThrow(/feeRate/);
    expect(() =>
      addChannel(g, { ...edge('neg-bal', 'S', 'T', 0n), availableBalance: -1n }),
    ).toThrow(/availableBalance/);
    expect(() =>
      addChannel(g, { ...edge('neg-cap', 'S', 'T', 0n), htlcCapacity: -1n }),
    ).toThrow(/htlcCapacity/);
  });

  test('rejects invalid maxHops and non-positive amounts', () => {
    const g = createChannelGraph();
    addChannel(g, edge('s-t', 'S', 'T', 0n));

    expect(() => findRoute(g, 'S', 'T', SCALE, TOKEN, { maxHops: -1 })).toThrow(/maxHops/);
    expect(() => findRoute(g, 'S', 'T', SCALE, TOKEN, { maxHops: 1.5 })).toThrow(/maxHops/);
    expect(findRoute(g, 'S', 'T', 0n, TOKEN)).toBeNull();
  });
});

describe('differential check against brute force', () => {
  function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function bruteForce(
    graph: ChannelGraph,
    from: string,
    to: string,
    amount: bigint,
    tokenId: string,
    maxHops: number,
  ): { fees: bigint; hops: number } | null {
    if (from === to) return { fees: 0n, hops: 0 };
    let best: { fees: bigint; hops: number } | null = null;
    const visited = new Set<string>([from]);

    const walk = (node: string, depth: number, fees: bigint): void => {
      if (depth >= maxHops) return;
      for (const e of graph.nodeEdges.get(node) ?? []) {
        if (e.tokenId !== tokenId) continue;
        if (e.feeRate < 0n) continue;
        if (e.availableBalance < amount) continue;
        const nextFees = fees + (amount * e.feeRate) / SCALE;
        if (e.to === to) {
          if (
            !best ||
            nextFees < best.fees ||
            (nextFees === best.fees && depth + 1 < best.hops)
          ) {
            best = { fees: nextFees, hops: depth + 1 };
          }
          continue;
        }
        if (visited.has(e.to)) continue;
        visited.add(e.to);
        walk(e.to, depth + 1, nextFees);
        visited.delete(e.to);
      }
    };

    walk(from, 0, 0n);
    return best;
  }

  test('matches brute force on random small graphs', () => {
    const rng = mulberry32(0xc0ffee);
    const nodeCount = 6;
    const nodes = Array.from({ length: nodeCount }, (_, i) => `n${i}`);

    for (let iter = 0; iter < 40; iter++) {
      const g = createChannelGraph();
      for (let i = 0; i < 10; i++) {
        const from = nodes[Math.floor(rng() * nodeCount)];
        let to = nodes[Math.floor(rng() * nodeCount)];
        if (to === from) to = nodes[(nodes.indexOf(from) + 1) % nodeCount];
        addChannel(g, edge(`c${iter}-${i}`, from, to, BigInt(Math.floor(rng() * 4))));
      }

      const from = nodes[0];
      const to = nodes[nodeCount - 1];
      const maxHops = 1 + Math.floor(rng() * 5);
      const route = findRoute(g, from, to, SCALE, TOKEN, { maxHops });
      const expected = bruteForce(g, from, to, SCALE, TOKEN, maxHops);

      if (expected === null) {
        expect(route).toBeNull();
      } else {
        expect(route).not.toBeNull();
        expect(route!.totalFees).toBe(expected.fees);
        expect(route!.hops).toHaveLength(expected.hops);
      }
    }
  });
});


describe('cross-token global hop budget', () => {
  function longCrossGraph(): ChannelGraph {
    const g = createChannelGraph();
    // 5 hops in TOKEN: S → p1 → p2 → p3 → p4 → pre
    const a = ['S', 'p1', 'p2', 'p3', 'p4', 'pre'];
    for (let i = 0; i < a.length - 1; i++) {
      addChannel(g, edge(`a${i}`, a[i], a[i + 1], 0n));
    }
    // Swap channels: pre → BRIDGE (TOKEN), BRIDGE → post (TOKEN_B).
    addChannel(g, edge('in-chan', 'pre', 'BRIDGE', 0n));
    addChannel(g, { ...edge('out-chan', 'BRIDGE', 'post', 0n), tokenId: TOKEN_B });
    // 5 hops in TOKEN_B: post → q1 → q2 → q3 → q4 → T
    const b = ['post', 'q1', 'q2', 'q3', 'q4', 'T'];
    for (let i = 0; i < b.length - 1; i++) {
      addChannel(g, { ...edge(`b${i}`, b[i], b[i + 1], 0n), tokenId: TOKEN_B });
    }
    announceSwap(g, {
      intermediaryPubKey: 'BRIDGE',
      tokenIn: TOKEN,
      tokenOut: TOKEN_B,
      rate: '1',
      inboundChannelId: 'in-chan',
      outboundChannelId: 'out-chan',
      maxAmountIn: 1_000_000n * SCALE,
    });
    return g;
  }

  test('counts pre + swap + post against one maxHops budget', () => {
    const g = longCrossGraph();

    // 5 pre + 1 swap + 5 post = 11 hops; not reachable with maxHops=8.
    expect(findCrossTokenRoute(g, 'S', 'T', SCALE, TOKEN, TOKEN_B, { maxHops: 8 })).toBeNull();

    const route = findCrossTokenRoute(g, 'S', 'T', SCALE, TOKEN, TOKEN_B, { maxHops: 11 });
    expect(route).not.toBeNull();
    expect(route!.hops).toHaveLength(11);
    expect(route!.swapHops).toHaveLength(1);
    expect(route!.totalFees).toBe(0n);
  });

  test('still allows a direct swap with maxHops=1', () => {
    const g = createChannelGraph();
    addChannel(g, edge('in-chan', 'S', 'BRIDGE', 0n));
    addChannel(g, { ...edge('out-chan', 'BRIDGE', 'T', 0n), tokenId: TOKEN_B });
    announceSwap(g, {
      intermediaryPubKey: 'BRIDGE',
      tokenIn: TOKEN,
      tokenOut: TOKEN_B,
      rate: '1',
      inboundChannelId: 'in-chan',
      outboundChannelId: 'out-chan',
      maxAmountIn: 1_000_000n * SCALE,
    });

    const route = findCrossTokenRoute(g, 'S', 'T', SCALE, TOKEN, TOKEN_B, { maxHops: 1 });
    expect(route).not.toBeNull();
    expect(route!.hops).toHaveLength(1);
  });
});
