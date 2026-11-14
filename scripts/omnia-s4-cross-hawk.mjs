#!/usr/bin/env node
/**
 * S4 — core Omnia channel lifecycle across two nodes.
 *
 *   openChannel -> pay -> settle (on-chain) -> closeChannel
 *
 * Drives both `omnia-host` control planes and the funding node's RPC. Run it
 * wherever both node/control ports are reachable (same host or over a VPN).
 *
 * Env:
 *   NODE_A / NODE_B          Minima RPC (default http://127.0.0.1:9005 / :9015)
 *   HOST_A / HOST_B          omnia-host JSON-RPC (default :50052/rpc / :50053/rpc)
 *   MINIMA_RPC_PASSWORD      node RPC password (default "test")
 *   RPC_TOKEN                control-plane bearer token (default "test")
 *   S4_CONTEST_DELAY         contest delay blocks (default 2)
 *   S4_PAY_AMOUNT            off-chain payment amount (default 100000000)
 *
 * Flags:
 *   --json                   only print the final result JSON
 *
 * Result: prints an `OMNIA_RESULT {...}` line; use it to update
 * docs/OMNIA_TEST_RESULTS.md.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildScriptProof } = require('../packages/core/dist/cjs/index.js');

const NODE_A = process.env.NODE_A ?? 'http://127.0.0.1:9005';
const NODE_B = process.env.NODE_B ?? 'http://127.0.0.1:9015';
const HOST_A = process.env.HOST_A ?? 'http://127.0.0.1:50052/rpc';
const HOST_B = process.env.HOST_B ?? 'http://127.0.0.1:50053/rpc';
const MINIMA_RPC_PASSWORD = process.env.MINIMA_RPC_PASSWORD ?? 'test';
const RPC_TOKEN_A = process.env.RPC_TOKEN_A ?? process.env.RPC_TOKEN ?? 'test';
const RPC_TOKEN_B = process.env.RPC_TOKEN_B ?? process.env.RPC_TOKEN ?? 'test';
const CONTEST_DELAY = Number(process.env.S4_CONTEST_DELAY ?? 2);
const PAY_AMOUNT = process.env.S4_PAY_AMOUNT ?? '100000000';
const JSON_ONLY = process.argv.includes('--json');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...args) => { if (!JSON_ONLY) console.log(...args); };

async function node(base, command) {
  const res = await fetch(`${base.replace(/\/$/, '')}/`, {
    method: 'POST',
    headers: {
      authorization: 'Basic ' + Buffer.from(`minima:${MINIMA_RPC_PASSWORD}`).toString('base64'),
    },
    body: command,
  });
  const body = await res.json().catch(() => ({}));
  if (body.error) throw new Error(`${command.split(' ')[0]}: ${body.error}`);
  return body.response;
}

let seq = 0;
async function host(base, method, params = {}, timeoutMs = 900_000) {
  const id = ++seq;
  const res = await fetch(base, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${base === HOST_B ? RPC_TOKEN_B : RPC_TOKEN_A}` },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await res.json().catch(() => ({}));
  if (body.error) throw new Error(`${method}: ${body.error.message ?? JSON.stringify(body.error)}`);
  return body.result;
}

async function waitFor(label, attempts, delayMs, fn) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    try {
      last = await fn();
      if (last) return last;
    } catch (err) {
      last = err;
    }
    await sleep(delayMs);
  }
  throw new Error(`${label} timed out (${attempts} attempts)`);
}

async function main() {
  const whoA = await host(HOST_A, 'totem_omniaWhoami');
  const whoB = await host(HOST_B, 'totem_omniaWhoami');
  log('A', whoA.identityId, whoA.publicKeyDigest);
  log('B', whoB.identityId, whoB.publicKeyDigest);

  const coins = await node(NODE_A, 'coins');
  const list = Array.isArray(coins) ? coins : (coins?.coins ?? []);
  const coin = list.find((c) => !c.spent && BigInt(c.amount) > 0n && (!c.tokenid || c.tokenid === '0x00'));
  if (!coin) throw new Error('no spendable native coin on NODE_A');
  log('funding coin', coin.coinid, coin.amount);

  const addr = await node(NODE_A, `getaddressinfo address:${coin.address}`);
  const exported = await node(NODE_A, `coinexport coinid:${coin.coinid}`);
  if (!addr?.publickey || !addr?.script) throw new Error('getaddressinfo missing publickey/script');
  if (!exported?.data) throw new Error('coinexport missing data');

  const total = BigInt(coin.amount);
  const localAmount = ((total * 6n) / 10n).toString();
  const remoteAmount = (total - BigInt(localAmount)).toString();

  const opened = await host(HOST_A, 'totem_omniaOpenChannel', {
    operationId: `s4-open-${Date.now()}`,
    remotePartyId: whoB.identityId,
    remotePublicKeyDigest: whoB.publicKeyDigest,
    remoteAddressIndex: 0,
    localAmount,
    remoteAmount,
    fundingCoinId: coin.coinid,
    fundingPubkey: addr.publickey,
    fundingCoinProofsHex: [exported.data],
    fundingScript: addr.script,
    contestDelayBlocks: CONTEST_DELAY,
  });
  const channelId = opened.channelId;
  if (!channelId) throw new Error(`openChannel returned no channelId: ${JSON.stringify(opened)}`);
  log('channel', channelId);

  const active = await waitFor('channel active', 900, 1_000, async () => {
    const state = await host(HOST_A, 'totem_omniaGetChannelState', { channelId });
    return state.status === 'active' ? state : null;
  });
  log('A status', active.status, 'fundingCoin', active.fundingCoinId);

  const paid = await host(HOST_A, 'totem_omniaPay', {
    operationId: `s4-pay-${Date.now()}`,
    channelId,
    amount: PAY_AMOUNT,
  });
  log('pay', JSON.stringify(paid));

  const stateB = await waitFor('counterparty state update', 60, 1_000, async () => {
    const state = await host(HOST_B, 'totem_omniaGetChannelState', { channelId });
    return state.currentSequence >= 1 ? state : null;
  });
  const stateA = await host(HOST_A, 'totem_omniaGetChannelState', { channelId });
  log('A seq', stateA.currentSequence, JSON.stringify(stateA.balances));
  log('B seq', stateB.currentSequence, JSON.stringify(stateB.balances));

  // The eltoo contest delay is relative to the funding coin's @COINAGE, which is
  // evaluated at the next block; wait delay + 1 blocks before settling.
  const freshCoin = () => node(NODE_A, `coinexport coinid:${stateA.fundingCoinId}`);
  let created = Number((await freshCoin())?.coinproof?.coin?.created ?? 0);
  for (let i = 0; i < 300; i += 1) {
    const tip = await node(NODE_A, 'getchaintip');
    const age = Number(tip.block) - created;
    if (i % 5 === 0) log('channel coinage', age, '/', CONTEST_DELAY + 1);
    if (age >= CONTEST_DELAY + 1) break;
    await sleep(2_000);
    created = Number((await freshCoin())?.coinproof?.coin?.created ?? created);
  }

  const channelExport = await freshCoin();
  if (!channelExport?.data) throw new Error('channel coin export missing (already spent?)');
  const scriptProof = buildScriptProof(stateA.fundingScript);
  const settlement = await host(HOST_A, 'totem_omniaSettle', {
    operationId: `s4-settle-${Date.now()}`,
    channelId,
    broadcastProofs: {
      coinProofs: [channelExport.data],
      scriptProofs: ['0x' + Buffer.from(scriptProof).toString('hex')],
    },
  });
  log('settle', JSON.stringify(settlement));

  const closed = await host(HOST_A, 'totem_omniaCloseChannel', {
    operationId: `s4-close-${Date.now()}`,
    channelId,
  });
  log('close', JSON.stringify(closed));

  const result = {
    stage: 'S4',
    at: new Date().toISOString(),
    hosts: { A: HOST_A, B: HOST_B },
    nodes: { A: NODE_A, B: NODE_B },
    channelId,
    fundingCoinId: coin.coinid,
    settlementTxId: settlement.settlementTxId ?? settlement.settlementPayload?.txpowId,
    sequence: stateB.currentSequence,
    balances: stateB.balances,
    pass: true,
  };
  console.log(`OMNIA_RESULT ${JSON.stringify(result)}`);
  console.log('S4_PASS');
}

main().catch((err) => {
  console.error(JSON_ONLY ? JSON.stringify({ stage: 'S4', pass: false, error: String(err) }) : err?.stack ?? err);
  console.error('S4_FAIL');
  process.exit(1);
});
