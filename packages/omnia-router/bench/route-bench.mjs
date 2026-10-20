#!/usr/bin/env node
/**
 * Bounded routing benchmark (RFC-055 Phase 1).
 *
 * Compares the layered bounded search (`findRoute`) against a binary-heap
 * Dijkstra baseline on the same graph, with the same cost model.
 *
 * Usage:
 *   npm run build            # produce packages/omnia-router/dist
 *   npm run bench            # 1k / 10k / 100k edges
 *   npm run bench -- --1m    # add 1m edges
 */
import { performance } from 'node:perf_hooks';
import { addChannel, createChannelGraph, findRoute } from '../dist/index.js';
import { createRoutingGraphSnapshot, selectRoutingEngine, FIXED_AMOUNT_COST_MODEL } from '../dist/routing-engine.js';

const SCALE = 100_000_000n;
const TOKEN = '0x' + '00'.repeat(32);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class MinHeap {
  constructor(compare) {
    this.items = [];
    this.compare = compare;
  }
  get size() {
    return this.items.length;
  }
  push(value) {
    const items = this.items;
    items.push(value);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(items[parent], items[i]) <= 0) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }
  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0 && last !== undefined) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let best = i;
        if (left < items.length && this.compare(items[left], items[best]) < 0) best = left;
        if (right < items.length && this.compare(items[right], items[best]) < 0) best = right;
        if (best === i) break;
        [items[best], items[i]] = [items[i], items[best]];
        i = best;
      }
    }
    return top;
  }
}

function compareFees(a, b) {
  if (a.fees < b.fees) return -1;
  if (a.fees > b.fees) return 1;
  return a.hops - b.hops;
}

// Correct hop-constrained Dijkstra: state is (node, hops), priority (fees, hops).
function hopAwareHeap(graph, from, to, amount, tokenId, maxHops) {
  const best = new Map();
  const key = (node, hops) => `${node}|${hops}`;
  best.set(key(from, 0), 0n);
  const queue = new MinHeap(compareFees);
  queue.push({ node: from, fees: 0n, hops: 0 });

  while (queue.size > 0) {
    const state = queue.pop();
    const current = best.get(key(state.node, state.hops));
    if (current === undefined || current !== state.fees) continue;
    if (state.node === to) return state;
    if (state.hops >= maxHops) continue;

    for (const edge of graph.nodeEdges.get(state.node) ?? []) {
      if (edge.tokenId !== tokenId) continue;
      if (edge.feeRate < 0n) continue;
      if (edge.availableBalance < amount) continue;
      const fees = state.fees + (amount * edge.feeRate) / SCALE;
      const hops = state.hops + 1;
      const k = key(edge.to, hops);
      const previous = best.get(k);
      if (previous === undefined || fees < previous) {
        best.set(k, fees);
        queue.push({ node: edge.to, fees, hops });
      }
    }
  }
  return null;
}

// Legacy one-label-per-node greedy (NOT hop-correct; shown for contrast only).
function greedyHeap(graph, from, to, amount, tokenId, maxHops) {
  const best = new Map([[from, { fees: 0n, hops: 0 }]]);
  const queue = new MinHeap(compareFees);
  queue.push({ node: from, fees: 0n, hops: 0 });

  while (queue.size > 0) {
    const state = queue.pop();
    const current = best.get(state.node);
    if (!current || current.fees !== state.fees || current.hops !== state.hops) continue;
    if (state.node === to) return state;
    if (state.hops >= maxHops) continue;

    for (const edge of graph.nodeEdges.get(state.node) ?? []) {
      if (edge.tokenId !== tokenId) continue;
      if (edge.feeRate < 0n) continue;
      if (edge.availableBalance < amount) continue;
      const fees = state.fees + (amount * edge.feeRate) / SCALE;
      const hops = state.hops + 1;
      const previous = best.get(edge.to);
      if (!previous || fees < previous.fees || (fees === previous.fees && hops < previous.hops)) {
        best.set(edge.to, { fees, hops });
        queue.push({ node: edge.to, fees, hops });
      }
    }
  }
  return null;
}

function buildGraph(edgeCount, seed, zeroFee = false) {
  const rng = mulberry32(seed);
  const graph = createChannelGraph();
  const balance = 10n ** 18n;
  const nodeCount = Math.max(2, Math.ceil(edgeCount / 4));
  const nodes = Array.from({ length: nodeCount }, (_, i) => `n${i}`);
  let id = 0;

  const add = (from, to) => {
    if (from === to) return;
    addChannel(graph, {
      channelId: `c${id++}`,
      from,
      to,
      tokenId: TOKEN,
      availableBalance: balance,
      htlcCapacity: balance,
      feeRate: zeroFee ? 0n : BigInt(Math.floor(rng() * 1000)),
    });
  };

  // Guarantee a connected chain.
  for (let i = 0; i < nodeCount - 1 && id < edgeCount; i++) add(nodes[i], nodes[i + 1]);
  // Fill the rest with random directed edges.
  let attempts = 0;
  while (id < edgeCount && attempts < edgeCount * 10) {
    attempts++;
    add(nodes[Math.floor(rng() * nodeCount)], nodes[Math.floor(rng() * nodeCount)]);
  }

  return { graph, nodes, token: TOKEN };
}

function timeMs(fn, iterations) {
  const start = performance.now();
  let last;
  for (let i = 0; i < iterations; i++) last = fn();
  return { ms: performance.now() - start, last };
}

const sizes = [1_000, 10_000, 100_000];
if (process.argv.includes('--1m')) sizes.push(1_000_000);

const iterations = 20;
const maxHops = 8;
const amount = SCALE;

function runSuite(label, zeroFee) {
  console.log(`\n${label}`);
  console.log('edges\tnodes\tfindRoute(ms)\thopAwareHeap(ms)\tgreedy1label(ms)\ttreeBuild(ms)\ttreeRoute10x(ms)\troute');
  for (const edges of sizes) {
    const { graph, nodes, token } = buildGraph(edges, 0xbeef ^ edges ^ (zeroFee ? 0x9e3779b9 : 0), zeroFee);
    const from = nodes[0];
    const to = nodes[Math.min(7, nodes.length - 1)];

    // Warm up.
    for (let i = 0; i < 3; i++) {
      findRoute(graph, from, to, amount, token, { maxHops });
      hopAwareHeap(graph, from, to, amount, token, maxHops);
      greedyHeap(graph, from, to, amount, token, maxHops);
    }

    const routed = timeMs(
      () => findRoute(graph, from, to, amount, token, { maxHops }),
      iterations,
    );
    const hopAware = timeMs(
      () => hopAwareHeap(graph, from, to, amount, token, maxHops),
      iterations,
    );
    const greedy = timeMs(
      () => greedyHeap(graph, from, to, amount, token, maxHops),
      iterations,
    );

    const snapshot = createRoutingGraphSnapshot(graph);
    const engine = selectRoutingEngine(snapshot);
    const treeQuery = { source: from, amount, tokenId: token, maxHops };
    const treeBuild = timeMs(
      () => engine.computeTree(snapshot, treeQuery, FIXED_AMOUNT_COST_MODEL),
      iterations,
    );
    const tree = engine.computeTree(snapshot, treeQuery, FIXED_AMOUNT_COST_MODEL);
    const treeRoute = timeMs(() => tree.routeTo(to), iterations * 10);

    console.log(
      `${edges}\t${nodes.length}\t${routed.ms.toFixed(1)}\t\t${hopAware.ms.toFixed(1)}\t\t${greedy.ms.toFixed(1)}\t\t${treeBuild.ms.toFixed(1)}\t\t${treeRoute.ms.toFixed(1)}\t\t${routed.last ? 'yes' : 'no'}`,
    );
  }
}

runSuite('weighted fees (findRoute = layered DP)', false);
runSuite('zero fees (findRoute = BFS fast path)', true);
