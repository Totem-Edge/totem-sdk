#!/usr/bin/env node
/**
 * S8 — fee-aware 3-hop single-token payment (SDK harness).
 *
 *   Alice --c1--> Hop1 --c2--> Hop2 --c3--> Carol
 *
 * The payer locks the payment plus downstream fees; each intermediary retains
 * its fee (hopAmount[i] - hopAmount[i+1]); the recipient receives the exact
 * payment amount. Uses the real routing engine and executor with deterministic
 * in-memory HTLC ops. No node, chain, or cloud host is required.
 *
 * Flags:
 *   --json        only print the final result JSON
 *
 * Result: prints an `OMNIA_RESULT {...}` line; use it to update
 * docs/OMNIA_TEST_RESULTS.md.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const router = require('../packages/omnia-router/dist/cjs/index.js');

const JSON_ONLY = process.argv.includes('--json');
const log = (...args) => { if (!JSON_ONLY) console.log(...args); };

const SCALE = 100_000_000n;
const TOKEN = '0x00';
const ALICE = 'pk-alice';
const HOP1 = 'pk-hop1';
const HOP2 = 'pk-hop2';
const CAROL = 'pk-carol';
const MOCK_LP = {};

function jsonBig(value) {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function mkEdge(id, from, to, feeRate) {
  return { channelId: id, from, to, tokenId: TOKEN, availableBalance: 1000n * SCALE, htlcCapacity: 1000n * SCALE, feeRate };
}

function mkChannel(id, from, to) {
  return {
    channelId: id,
    tokenId: TOKEN,
    parties: [
      { partyId: 'A', publicKeyDigest: from, addressIndex: 0 },
      { partyId: 'B', publicKeyDigest: to, addressIndex: 0 },
    ],
    balances: { A: 1000n * SCALE, B: 0n },
    pendingHTLCs: [],
    totalValue: 1000n * SCALE,
    currentSequence: 0,
    status: 'active',
    localSigner: { publicKeyDigest: from },
  };
}

function makeMockOps() {
  const addHTLC = async (channel, params) => {
    const htlcId = `htlc-${channel.channelId}-${channel.currentSequence + 1}`;
    const senderPkd = channel.localSigner?.publicKeyDigest ?? channel.parties[0].publicKeyDigest;
    const senderPartyId = channel.parties.find((p) => p.publicKeyDigest === senderPkd)?.partyId ?? 'A';
    const newBalances = { ...channel.balances };
    newBalances[senderPartyId] = (newBalances[senderPartyId] ?? 0n) - params.amount;
    return {
      htlcId,
      channel: {
        ...channel,
        balances: newBalances,
        pendingHTLCs: [
          ...channel.pendingHTLCs,
          {
            htlcId,
            amount: params.amount,
            hashlock: params.hashlock,
            timeoutBlock: params.timeoutBlock,
            direction: params.direction,
            status: 'pending',
            htlcAddress: '0xhtlc',
            senderPublicKeyDigest: senderPkd,
            recipientPublicKeyDigest: params.counterpartPublicKeyDigest,
          },
        ],
        currentSequence: channel.currentSequence + 1,
      },
    };
  };

  const fulfillHTLC = async (channel, htlcId) => {
    const htlc = channel.pendingHTLCs.find((h) => h.htlcId === htlcId);
    if (!htlc) return { channel, error: `HTLC ${htlcId} not found` };
    const recipPartyId = channel.parties.find((p) => p.publicKeyDigest === htlc.recipientPublicKeyDigest)?.partyId ?? 'B';
    const newBalances = { ...channel.balances };
    newBalances[recipPartyId] = (newBalances[recipPartyId] ?? 0n) + htlc.amount;
    return {
      channel: {
        ...channel,
        balances: newBalances,
        pendingHTLCs: channel.pendingHTLCs.map((h) => (h.htlcId === htlcId ? { ...h, status: 'fulfilled' } : h)),
        currentSequence: channel.currentSequence + 1,
      },
    };
  };

  const timeoutHTLC = async (channel, htlcId) => {
    const htlc = channel.pendingHTLCs.find((h) => h.htlcId === htlcId);
    if (!htlc) return { channel, error: `HTLC ${htlcId} not found` };
    const senderPartyId = channel.parties.find((p) => p.publicKeyDigest === htlc.senderPublicKeyDigest)?.partyId ?? 'A';
    const newBalances = { ...channel.balances };
    newBalances[senderPartyId] = (newBalances[senderPartyId] ?? 0n) + htlc.amount;
    return {
      channel: {
        ...channel,
        balances: newBalances,
        pendingHTLCs: channel.pendingHTLCs.map((h) => (h.htlcId === htlcId ? { ...h, status: 'timed_out' } : h)),
        currentSequence: channel.currentSequence + 1,
      },
    };
  };

  return { addHTLC, fulfillHTLC, timeoutHTLC };
}

async function main() {
  const amount = 100n * SCALE;
  const feeRate = 100_000n; // 0.1% per hop; the recipient's (last) edge is fee-free

  const graph = router.createChannelGraph();
  router.addChannel(graph, mkEdge('c1', ALICE, HOP1, feeRate));
  router.addChannel(graph, mkEdge('c2', HOP1, HOP2, feeRate));
  router.addChannel(graph, mkEdge('c3', HOP2, CAROL, 0n));

  const route = router.findRoute(graph, ALICE, CAROL, amount, TOKEN);
  if (!route) throw new Error('no route found');
  assert(route.hops.length === 3, `expected 3 hops, got ${route.hops.length}`);

  const channels = new Map([
    ['c1', mkChannel('c1', ALICE, HOP1)],
    ['c2', mkChannel('c2', HOP1, HOP2)],
    ['c3', mkChannel('c3', HOP2, CAROL)],
  ]);
  const leaseProviders = new Map([
    ['c1', MOCK_LP],
    ['c2', MOCK_LP],
    ['c3', MOCK_LP],
  ]);

  const request = router.buildPaymentRequest(amount, TOKEN, 1000n);
  const result = await router.executeMultiHopPayment(makeMockOps(), channels, route, request, leaseProviders);
  assert(result.success, `payment failed: ${result.error}`);
  assert(result.settledHops.length === 3, 'not all hops settled');
  assert(result.feeProofs && result.feeProofs.length === 3, 'missing fee proofs');

  const fee0 = (amount * feeRate) / SCALE;
  const fee1 = fee0;
  const payerLock = amount + fee0 + fee1;
  const hopAmounts = route.hops.map((h) => h.amount);
  assert(hopAmounts[0] === payerLock, `payer lock ${hopAmounts[0]} != ${payerLock}`);
  assert(hopAmounts[1] === amount + fee1, `hop1 amount ${hopAmounts[1]} != ${amount + fee1}`);
  assert(hopAmounts[2] === amount, `recipient hop amount ${hopAmounts[2]} != ${amount}`);

  const c1 = channels.get('c1');
  const c2 = channels.get('c2');
  const c3 = channels.get('c3');
  const hop1Net = c1.balances.B - (1000n * SCALE - c2.balances.A);
  const hop2Net = c2.balances.B - (1000n * SCALE - c3.balances.A);
  assert(c3.balances.B === amount, `recipient got ${c3.balances.B} != ${amount}`);
  assert(hop1Net === fee0, `hop1 retained ${hop1Net} != ${fee0}`);
  assert(hop2Net === fee1, `hop2 retained ${hop2Net} != ${fee1}`);
  assert(c1.balances.A === 1000n * SCALE - payerLock, 'payer balance mismatch');
  log('payer lock', payerLock.toString(), 'fees', fee0.toString(), fee1.toString());
  log('hop amounts', hopAmounts.map((a) => a.toString()).join(' -> '));
  log('retained', hop1Net.toString(), hop2Net.toString(), 'recipient', c3.balances.B.toString());

  const out = {
    stage: 'S8',
    at: new Date().toISOString(),
    tokenId: TOKEN,
    amount: amount.toString(),
    feeRate: feeRate.toString(),
    route: route.hops.map((h) => ({ channelId: h.channelId, from: h.from, to: h.to })),
    hopAmounts: hopAmounts.map((a) => a.toString()),
    feesRetained: { hop1: hop1Net.toString(), hop2: hop2Net.toString() },
    payerPaid: payerLock.toString(),
    recipientReceived: c3.balances.B.toString(),
    settledHops: result.settledHops.length,
    feeProofs: result.feeProofs.length,
    pass: true,
  };
  console.log(`OMNIA_RESULT ${JSON.stringify(jsonBig(out))}`);
  console.log('S8_PASS');
}

main().catch((err) => {
  console.error(JSON_ONLY ? JSON.stringify({ stage: 'S8', pass: false, error: String(err) }) : err?.stack ?? err);
  console.error('S8_FAIL');
  process.exit(1);
});
