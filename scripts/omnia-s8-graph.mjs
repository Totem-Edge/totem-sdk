#!/usr/bin/env node
/**
 * S8 graph — 8-node routing graph and 7-hop fee-aware payment.
 *
 * Ring: A-B-C-D-E-F-G-H-A. Chords: A-E, B-F, C-G, D-H.
 * Asserts the ring-only A->H route is 7 hops, the chorded route is shorter,
 * and a 7-hop payment settles with per-hop fee retention.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const router = require('../packages/omnia-router/dist/cjs/index.js');

const SCALE = 100_000_000n;
const TOKEN = '0x00';
const NODES = ['pk-A', 'pk-B', 'pk-C', 'pk-D', 'pk-E', 'pk-F', 'pk-G', 'pk-H'];
const RING = NODES.map((node, i) => ({ id: `ring-${node}-${NODES[(i + 1) % NODES.length]}`, from: node, to: NODES[(i + 1) % NODES.length] }));
const CHORDS = [
  { id: 'chord-A-E', from: 'pk-A', to: 'pk-E' },
  { id: 'chord-B-F', from: 'pk-B', to: 'pk-F' },
  { id: 'chord-C-G', from: 'pk-C', to: 'pk-G' },
  { id: 'chord-D-H', from: 'pk-D', to: 'pk-H' },
];

const json = (value) => JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function mkEdge(edge, feeRate) {
  return { channelId: edge.id, from: edge.from, to: edge.to, tokenId: TOKEN, availableBalance: 100000n * SCALE, htlcCapacity: 100000n * SCALE, feeRate };
}
function mkChannel(edge) {
  return {
    channelId: edge.id,
    tokenId: TOKEN,
    parties: [
      { partyId: edge.from, publicKeyDigest: edge.from, addressIndex: 0 },
      { partyId: edge.to, publicKeyDigest: edge.to, addressIndex: 0 },
    ],
    balances: { [edge.from]: 100000n * SCALE, [edge.to]: 0n },
    pendingHTLCs: [],
    totalValue: 100000n * SCALE,
    currentSequence: 0,
    status: 'active',
    localSigner: { publicKeyDigest: edge.from },
  };
}
function mockOps() {
  const addHTLC = async (channel, params) => {
    const htlcId = `htlc-${channel.channelId}-${channel.currentSequence + 1}`;
    const senderPkd = channel.localSigner?.publicKeyDigest ?? channel.parties[0].publicKeyDigest;
    const sender = channel.parties.find((p) => p.publicKeyDigest === senderPkd)?.partyId ?? channel.parties[0].partyId;
    const balances = { ...channel.balances };
    balances[sender] -= params.amount;
    return { htlcId, channel: { ...channel, balances, pendingHTLCs: [...channel.pendingHTLCs, { htlcId, amount: params.amount, hashlock: params.hashlock, timeoutBlock: params.timeoutBlock, direction: params.direction, status: 'pending', htlcAddress: '0xhtlc', senderPublicKeyDigest: senderPkd, recipientPublicKeyDigest: params.counterpartPublicKeyDigest }], currentSequence: channel.currentSequence + 1 } };
  };
  const fulfillHTLC = async (channel, htlcId) => {
    const htlc = channel.pendingHTLCs.find((h) => h.htlcId === htlcId);
    if (!htlc) return { channel, error: `HTLC ${htlcId} not found` };
    const recipient = channel.parties.find((p) => p.publicKeyDigest === htlc.recipientPublicKeyDigest)?.partyId ?? channel.parties[1].partyId;
    const balances = { ...channel.balances };
    balances[recipient] += htlc.amount;
    return { channel: { ...channel, balances, pendingHTLCs: channel.pendingHTLCs.map((h) => h.htlcId === htlcId ? { ...h, status: 'fulfilled' } : h), currentSequence: channel.currentSequence + 1 } };
  };
  const timeoutHTLC = async (channel, htlcId) => {
    const htlc = channel.pendingHTLCs.find((h) => h.htlcId === htlcId);
    if (!htlc) return { channel, error: `HTLC ${htlcId} not found` };
    const sender = channel.parties.find((p) => p.publicKeyDigest === htlc.senderPublicKeyDigest)?.partyId ?? channel.parties[0].partyId;
    const balances = { ...channel.balances };
    balances[sender] += htlc.amount;
    return { channel: { ...channel, balances, pendingHTLCs: channel.pendingHTLCs.map((h) => h.htlcId === htlcId ? { ...h, status: 'timed_out' } : h), currentSequence: channel.currentSequence + 1 } };
  };
  return { addHTLC, fulfillHTLC, timeoutHTLC };
}
function buildGraph(edges, feeRate) {
  const graph = router.createChannelGraph();
  for (const edge of edges) router.addChannel(graph, mkEdge(edge, edge.to === 'pk-H' ? 0n : feeRate));
  return graph;
}

async function main() {
  const amount = 100n * SCALE;
  const feeRate = 100_000n;
  const ringGraph = buildGraph(RING, feeRate);
  const ringRoute = router.findRoute(ringGraph, 'pk-A', 'pk-H', amount, TOKEN);
  assert(ringRoute, 'no ring route');
  assert(ringRoute.hops.length === 7, `expected 7-hop ring route, got ${ringRoute.hops.length}`);

  for (const from of NODES) {
    for (const to of NODES) {
      if (from === to) continue;
      assert(router.findRoute(ringGraph, from, to, amount, TOKEN), `no ring route ${from}->${to}`);
    }
  }

  const chordGraph = buildGraph([...RING, ...CHORDS], feeRate);
  const chordRoute = router.findRoute(chordGraph, 'pk-A', 'pk-H', amount, TOKEN);
  assert(chordRoute, 'no chord route');
  assert(chordRoute.hops.length < 7, `expected chord route < 7 hops, got ${chordRoute.hops.length}`);

  const channels = new Map([...RING, ...CHORDS].map((edge) => [edge.id, mkChannel(edge)]));
  const leases = new Map([...channels.keys()].map((id) => [id, {}]));
  const request = router.buildPaymentRequest(amount, TOKEN, 1000n);
  const result = await router.executeMultiHopPayment(mockOps(), channels, ringRoute, request, leases);
  assert(result.success, `7-hop payment failed: ${result.error}`);
  assert(result.settledHops.length === 7, 'not all 7 hops settled');
  assert(result.feeProofs.length === 7, 'missing fee proofs');
  const recipient = channels.get('ring-pk-G-pk-H');
  assert(recipient.balances['pk-H'] === amount, `recipient received ${recipient.balances.H}`);

  const out = {
    stage: 'S8_GRAPH',
    at: new Date().toISOString(),
    nodes: NODES,
    ringEdges: RING.length,
    chordEdges: CHORDS.length,
    ringRouteHops: ringRoute.hops.length,
    chordRouteHops: chordRoute.hops.length,
    amount: amount.toString(),
    recipient: recipient.balances['pk-H'].toString(),
    settledHops: result.settledHops.length,
    pass: true,
  };
  console.log(`OMNIA_RESULT ${JSON.stringify(json(out))}`);
  console.log('S8_GRAPH_PASS');
}
main().catch((err) => { console.error(err?.stack ?? err); console.error('S8_GRAPH_FAIL'); process.exit(1); });
