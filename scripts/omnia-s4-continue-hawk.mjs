#!/usr/bin/env node
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { buildScriptProof } = require('../packages/core/dist/cjs/index.js');

const NODE_A = process.env.NODE_A;
const HOST_A = process.env.HOST_A;
const HOST_B = process.env.HOST_B;
const MINIMA_RPC_PASSWORD = process.env.MINIMA_RPC_PASSWORD;
const TOKEN_A = process.env.RPC_TOKEN_A;
const TOKEN_B = process.env.RPC_TOKEN_B;
const CHANNEL_ID = process.env.CHANNEL_ID;
const PAY_AMOUNT = process.env.S4_PAY_AMOUNT ?? '1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let seq = 0;
async function node(command) {
  const res = await fetch(`${NODE_A.replace(/\/$/, '')}/`, {
    method: 'POST',
    headers: { authorization: 'Basic ' + Buffer.from(`minima:${MINIMA_RPC_PASSWORD}`).toString('base64') },
    body: command,
  });
  const body = await res.json().catch(() => ({}));
  if (body.error) throw new Error(`${command.split(' ')[0]}: ${body.error}`);
  return body.response;
}
async function host(base, method, params = {}, timeoutMs = 900_000) {
  const id = ++seq;
  const token = base === HOST_B ? TOKEN_B : TOKEN_A;
  const res = await fetch(base, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
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
    try { last = await fn(); if (last) return last; } catch (e) { last = e; }
    await sleep(delayMs);
  }
  throw new Error(`${label} timed out (${attempts} attempts): ${last}`);
}
async function main() {
  const stateA = await host(HOST_A, 'totem_omniaGetChannelState', { channelId: CHANNEL_ID });
  const stateB = await host(HOST_B, 'totem_omniaGetChannelState', { channelId: CHANNEL_ID });
  console.log('A status', stateA.status, 'balances', JSON.stringify(stateA.balances), 'seq', stateA.currentSequence);
  console.log('B status', stateB.status, 'balances', JSON.stringify(stateB.balances), 'seq', stateB.currentSequence);

  const paid = await host(HOST_A, 'totem_omniaPay', { operationId: `s4-pay-${Date.now()}`, channelId: CHANNEL_ID, amount: PAY_AMOUNT });
  console.log('pay', JSON.stringify(paid));

  const bUpdated = await waitFor('counterparty state update', 180, 1_000, async () => {
    const s = await host(HOST_B, 'totem_omniaGetChannelState', { channelId: CHANNEL_ID });
    return s.currentSequence >= 1 ? s : null;
  });
  const aUpdated = await host(HOST_A, 'totem_omniaGetChannelState', { channelId: CHANNEL_ID });
  console.log('A seq', aUpdated.currentSequence, JSON.stringify(aUpdated.balances));
  console.log('B seq', bUpdated.currentSequence, JSON.stringify(bUpdated.balances));

  const contestDelay = Number(stateA.contestDelayBlocks ?? 2);
  let created = 0;
  for (let i = 0; i < 300; i += 1) {
    const c = await node(`coinexport coinid:${stateA.fundingCoinId}`);
    created = Number(c?.coinproof?.coin?.created ?? 0);
    const tip = await node('getchaintip');
    const age = Number(tip.block) - created;
    if (i % 5 === 0) console.log('channel coinage', age, '/', contestDelay + 1);
    if (age >= contestDelay + 1) break;
    await sleep(2_000);
  }
  const channelExport = await node(`coinexport coinid:${stateA.fundingCoinId}`);
  if (!channelExport?.data) throw new Error('funding coin export missing');
  const scriptProof = buildScriptProof(stateA.fundingScript);
  const settlement = await host(HOST_A, 'totem_omniaSettle', {
    operationId: `s4-settle-${Date.now()}`,
    channelId: CHANNEL_ID,
    broadcastProofs: {
      coinProofs: [channelExport.data],
      scriptProofs: ['0x' + Buffer.from(scriptProof).toString('hex')],
    },
  });
  console.log('settle', JSON.stringify(settlement));
  const closed = await host(HOST_A, 'totem_omniaCloseChannel', { operationId: `s4-close-${Date.now()}`, channelId: CHANNEL_ID });
  console.log('close', JSON.stringify(closed));
  const result = {
    stage: 'S4-continue', channelId: CHANNEL_ID,
    fundingTxId: stateA.fundingTxId,
    payAmount: PAY_AMOUNT,
    settlementTxId: settlement.settlementTxId ?? settlement.settlementPayload?.txpowId,
    sequence: bUpdated.currentSequence,
    balances: bUpdated.balances,
    pass: true,
  };
  console.log(`OMNIA_RESULT ${JSON.stringify(result)}`);
  console.log('S4_PASS');
}
main().catch((e) => { console.error(e?.stack ?? String(e)); console.error('S4_FAIL'); process.exit(1); });
