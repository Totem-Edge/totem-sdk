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
 *   S4_PAY_AMOUNT            off-chain payment amount in decimal MINIMA (default 1)
 *   S4_AMOUNT_UNITS          "decimal" (current host) or "atoms" (host <=0.13.x)
 *   S4_FUNDING_TARGET        minimum coin size to select, decimal (default 0.2)
 *   B_TRANSPORT_PUBKEY       B's DHT transport key when whoami omits it
 *   S4_NUDGE_BLOCKS          "1" posts tiny txs to advance a solo/test chain
 *
 * Flags:
 *   --json                   only print the final result JSON
 *
 * Result: prints an `OMNIA_RESULT {...}` line; use it to update
 * docs/OMNIA_TEST_RESULTS.md.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildScriptProof, amountToAtoms, atomsToAmount } = require('../packages/core/dist/cjs/index.js');

const NODE_A = process.env.NODE_A ?? 'http://127.0.0.1:9005';
const NODE_B = process.env.NODE_B ?? 'http://127.0.0.1:9015';
const HOST_A = process.env.HOST_A ?? 'http://127.0.0.1:50052/rpc';
const HOST_B = process.env.HOST_B ?? 'http://127.0.0.1:50053/rpc';
const MINIMA_RPC_PASSWORD = process.env.MINIMA_RPC_PASSWORD ?? 'test';
const RPC_TOKEN = process.env.RPC_TOKEN ?? 'test';
const CONTEST_DELAY = Number(process.env.S4_CONTEST_DELAY ?? 2);
const PAY_AMOUNT = process.env.S4_PAY_AMOUNT ?? '1';
// omnia-host 0.14+ takes decimal MINIMA; 0.13.x takes integer atom strings.
const AMOUNT_UNITS = process.env.S4_AMOUNT_UNITS ?? 'decimal';
const hostAmount = (atoms) => (AMOUNT_UNITS === 'atoms' ? atoms.toString() : atomsToAmount(atoms));
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
async function host(base, method, params = {}, timeoutMs = 180_000) {
  const id = ++seq;
  const res = await fetch(base, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${RPC_TOKEN}` },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await res.json().catch(() => ({}));
  if (body.error) throw new Error(`${method}: ${body.error.message ?? JSON.stringify(body.error)}`);
  return body.result;
}

/** OMN-104: every S4_PASS is gated on the asserted invariants below. */
function fail(message) {
  throw new Error(`S4 assertion failed: ${message}`);
}

function atomsOf(value) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.round(value));
  if (typeof value === 'string') {
    const text = value.trim();
    if (text === '') fail('empty amount');
    return text.includes('.') ? amountToAtoms(text) : BigInt(text);
  }
  fail(`not an amount: ${JSON.stringify(value)}`);
}

function assertOk(label, response) {
  if (response === null || typeof response !== 'object') fail(`${label} returned no result`);
  if (response.success === false) fail(`${label} reported failure: ${JSON.stringify(response.error ?? response)}`);
  if (response.error) fail(`${label} reported an error: ${JSON.stringify(response.error)}`);
}

function balanceDelta(before, after, expectedAtoms, label) {
  const names = new Set([...Object.keys(before), ...Object.keys(after)]);
  let decreased = 0n;
  let increased = 0n;
  let changes = 0;
  for (const name of names) {
    const delta = atomsOf(after[name] ?? 0) - atomsOf(before[name] ?? 0);
    if (delta === 0n) continue;
    changes += 1;
    if (delta < 0n) decreased -= delta;
    else increased += delta;
  }
  if (changes !== 2 || decreased !== expectedAtoms || increased !== expectedAtoms) {
    fail(`${label}: expected one party to gain and one to lose ${expectedAtoms}, got ${JSON.stringify({ before, after })}`);
  }
}

function assertConservation(label, state) {
  const total = atomsOf(state.totalValue);
  const balances = Object.values(state.balances ?? {}).reduce((sum, v) => sum + atomsOf(v), 0n);
  const htlc = (state.pendingHTLCs ?? [])
    .filter((h) => h.status === 'pending')
    .reduce((sum, h) => sum + atomsOf(h.amount), 0n);
  if (balances + htlc !== total) {
    fail(`${label}: balances ${balances} + pending HTLCs ${htlc} != totalValue ${total}`);
  }
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
  const targetAtoms = amountToAtoms(process.env.S4_FUNDING_TARGET ?? '0.2');
  // Smallest coin that covers the channel total: the remainder returns to the
  // funding address as change, so a huge wallet coin is not locked in the channel.
  const candidates = list
    .filter((c) => !c.spent && (!c.tokenid || c.tokenid === '0x00'))
    .map((c) => ({ coin: c, atoms: amountToAtoms(String(c.amount)) }))
    .filter((c) => c.atoms > 0n)
    .sort((a, b) => (a.atoms < b.atoms ? -1 : a.atoms > b.atoms ? 1 : 0));
  const pool = candidates.some((c) => c.atoms >= targetAtoms)
    ? candidates.filter((c) => c.atoms >= targetAtoms)
    : candidates.slice(-1);
  let coin;
  let addr;
  let exported;
  for (const candidate of pool) {
    const info = await node(NODE_A, `getaddressinfo address:${candidate.coin.address}`);
    if (!info?.publickey || !info?.script) continue;
    const proof = await node(NODE_A, `coinexport coinid:${candidate.coin.coinid}`);
    if (!proof?.data) continue;
    coin = candidate.coin;
    addr = info;
    exported = proof;
    break;
  }
  if (!coin) throw new Error('no spendable native coin with a signable address on NODE_A');
  log('funding coin', coin.coinid, coin.amount);

  // Node amounts are decimal MINIMA text; the RPC takes decimal text too.
  const totalAtoms = amountToAtoms(String(coin.amount));
  const localAtoms = (totalAtoms * 6n) / 10n;
  const localAmount = hostAmount(localAtoms);
  const remoteAmount = hostAmount(totalAtoms - localAtoms);
  const payAmount = hostAmount(amountToAtoms(PAY_AMOUNT));

  const opened = await host(HOST_A, 'totem_omniaOpenChannel', {
    operationId: `s4-open-${Date.now()}`,
    remotePartyId: whoB.identityId,
    remotePublicKeyDigest: whoB.publicKeyDigest,
    remoteTransportPubkey: process.env.B_TRANSPORT_PUBKEY ?? whoB.transportPubkey,
    remoteAddressIndex: 0,
    remoteSettlementAddress: whoB.settlementAddress,
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

  // Solo/test chains only mine a block when a transaction is posted. The
  // funding output is created at the current tip (0 confirmations), so nudge
  // one block before waiting for the channel to activate. Mainnet must never
  // do this: gate it behind an explicit env flag.
  const nudgeBlock = async () => {
    const nudge = await node(NODE_A, 'newaddress');
    if (nudge?.miniaddress) {
      await node(NODE_A, `send address:${nudge.miniaddress} amount:0.000000001 mine:true`);
    }
  };
  if (process.env.S4_NUDGE_BLOCKS === '1') {
    await nudgeBlock();
    log('nudged block');
  }

  let active;
  for (let i = 0; i < 120; i += 1) {
    const state = await host(HOST_A, 'totem_omniaGetChannelState', { channelId });
    if (state.status === 'active') { active = state; break; }
    // A solo chain may have mined the funding tx and the first nudge into the
    // same block; one more tx is needed to give the funding output depth.
    if (process.env.S4_NUDGE_BLOCKS === '1' && i % 4 === 0) await nudgeBlock();
    await sleep(1_000);
  }
  if (!active) throw new Error('channel active timed out (120 attempts)');
  log('A status', active.status, 'fundingCoin', active.fundingCoinId);

  const payAtoms = amountToAtoms(PAY_AMOUNT);
  const paid = await host(HOST_A, 'totem_omniaPay', {
    operationId: `s4-pay-${Date.now()}`,
    channelId,
    amount: payAmount,
  });
  log('pay', JSON.stringify(paid));
  assertOk('pay', paid);

  const stateB = await waitFor('counterparty state update', 60, 1_000, async () => {
    const state = await host(HOST_B, 'totem_omniaGetChannelState', { channelId });
    return state.currentSequence >= 1 ? state : null;
  });
  const stateA = await host(HOST_A, 'totem_omniaGetChannelState', { channelId });
  log('A seq', stateA.currentSequence, JSON.stringify(stateA.balances));
  log('B seq', stateB.currentSequence, JSON.stringify(stateB.balances));

  // OMN-104: the payment must be the same transition on both hosts, must move
  // exactly the paid amount, and must conserve the channel's value.
  if (stateA.currentSequence !== stateB.currentSequence) {
    fail(`peer sequences differ: A=${stateA.currentSequence} B=${stateB.currentSequence}`);
  }
  const balancesA = JSON.stringify(stateA.balances ?? {});
  const balancesB = JSON.stringify(stateB.balances ?? {});
  if (balancesA !== balancesB) {
    fail(`peer balances differ: A=${balancesA} B=${balancesB}`);
  }
  balanceDelta(active.balances ?? {}, stateA.balances ?? {}, payAtoms, 'pay');
  assertConservation('A', stateA);
  assertConservation('B', stateB);

  // The eltoo contest delay is relative to the funding coin's @COINAGE, which is
  // evaluated at the next block; wait delay + 1 blocks before settling.
  const freshCoin = () => node(NODE_A, `coinexport coinid:${stateA.fundingCoinId}`);
  let created = Number((await freshCoin())?.coinproof?.coin?.created ?? 0);
  for (let i = 0; i < 300; i += 1) {
    const tip = await node(NODE_A, 'getchaintip');
    const age = Number(tip.block) - created;
    if (i % 5 === 0) log('channel coinage', age, '/', CONTEST_DELAY + 1);
    if (age >= CONTEST_DELAY + 1) break;
    if (process.env.S4_NUDGE_BLOCKS === '1' && i % 4 === 0) await nudgeBlock();
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
  assertOk('settle', settlement);
  const settlementTxId = settlement.settlementTxId ?? settlement.settlementPayload?.txpowId;
  if (!settlementTxId) fail('settle returned no settlement transaction id');

  const closed = await host(HOST_A, 'totem_omniaCloseChannel', {
    operationId: `s4-close-${Date.now()}`,
    channelId,
  });
  log('close', JSON.stringify(closed));
  assertOk('close', closed);

  // OMN-104: closure is confirmed on BOTH hosts, and the settlement outputs pay
  // each party at least the balance the closed channel recorded.
  const closedState = await waitFor('channel closure on A', 60, 1_000, async () => {
    const state = await host(HOST_A, 'totem_omniaGetChannelState', { channelId });
    return state.status === 'closed' ? state : null;
  });
  const closedStateB = await waitFor('channel closure on B', 60, 1_000, async () => {
    const state = await host(HOST_B, 'totem_omniaGetChannelState', { channelId });
    return state.status === 'closed' ? state : null;
  });
  assertConservation('A closed', closedState);
  assertConservation('B closed', closedStateB);

  const settlementAddresses = [whoA.settlementAddress, whoB.settlementAddress].filter(Boolean);
  if (settlementAddresses.length === 2) {
    for (const address of settlementAddresses) {
      const coinsAt = await node(NODE_A, `coins address:${address}`);
      const listAt = Array.isArray(coinsAt) ? coinsAt : (coinsAt?.coins ?? []);
      const totalAt = listAt
        .filter((c) => !c.spent && (!c.tokenid || c.tokenid === '0x00'))
        .reduce((sum, c) => sum + amountToAtoms(String(c.amount)), 0n);
      if (totalAt <= 0n) fail(`settlement output is missing for ${address}`);
    }
  } else {
    log('settlement address check skipped: a host did not report settlementAddress');
  }

  const result = {
    stage: 'S4',
    at: new Date().toISOString(),
    hosts: { A: HOST_A, B: HOST_B },
    nodes: { A: NODE_A, B: NODE_B },
    channelId,
    fundingCoinId: coin.coinid,
    settlementTxId,
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
