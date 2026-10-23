#!/usr/bin/env node
/** RFC-058 non-custodial cooperative settle + close on a coordinator pair. */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildScriptProof } = require('../packages/core/dist/cjs/index.js');

const HOST_A = process.env.HOST_A ?? 'http://127.0.0.1:50055/rpc';
const HOST_B = process.env.HOST_B ?? 'http://172.31.74.14:50056/rpc';
const NODE = process.env.NODE ?? 'http://172.31.68.246:9029';
const TOKEN = process.env.RPC_TOKEN ?? 'test';
const NODE_PASSWORD = process.env.MINIMA_RPC_PASSWORD ?? 'test';
const CHANNEL = process.env.CHANNEL;
if (!CHANNEL) throw new Error('CHANNEL is required');

let seq = 0;
async function rpc(base, method, params = {}) {
  const res = await fetch(base, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++seq, method, params }),
    signal: AbortSignal.timeout(180000),
  });
  const body = await res.json().catch(() => ({}));
  if (body.error) throw new Error(`${method}: ${body.error.message ?? JSON.stringify(body.error)}`);
  return body.result;
}
async function node(command) {
  const res = await fetch(NODE, {
    method: 'POST',
    headers: { authorization: 'Basic ' + Buffer.from(`minima:${NODE_PASSWORD}`).toString('base64') },
    body: command,
  });
  const body = await res.json().catch(() => ({}));
  if (body.error) throw new Error(`${command.split(' ')[0]}: ${body.error}`);
  return body.response;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const state = await rpc(HOST_A, 'totem_omniaGetChannelState', { channelId: CHANNEL });
  if (state.currentSequence < 1) throw new Error('channel has no off-chain payment to settle');
  const exported = await node(`coinexport coinid:${state.fundingCoinId}`);
  if (!exported?.data) throw new Error('channel coin export missing');
  const created = Number(exported.coinproof?.coin?.created ?? 0);
  let tip = 0;
  for (let i = 0; i < 120; i += 1) {
    tip = Number((await node('getchaintip')).block);
    if (tip - created >= 3) break;
    await sleep(1000);
  }
  if (tip - created < 3) throw new Error(`channel coinage ${tip - created} < 3`);
  const scriptProof = buildScriptProof(state.fundingScript);
  const settled = await rpc(HOST_A, 'totem_omniaSettle', {
    operationId: `noncust-settle-${Date.now()}`,
    channelId: CHANNEL,
    broadcastProofs: {
      coinProofs: [exported.data],
      scriptProofs: ['0x' + Buffer.from(scriptProof).toString('hex')],
    },
  });
  const closed = await rpc(HOST_A, 'totem_omniaCloseChannel', {
    operationId: `noncust-close-${Date.now()}`,
    channelId: CHANNEL,
  });
  const result = {
    stage: 'NONCUSTODIAL_SETTLE',
    at: new Date().toISOString(),
    channelId: CHANNEL,
    sequence: state.currentSequence,
    settlementTxId: settled.settlementTxId,
    finalBalances: settled.finalBalances,
    closeStatus: closed.status,
    pass: Boolean(settled.settlementTxId),
  };
  console.log(`OMNIA_RESULT ${JSON.stringify(result)}`);
  console.log(result.pass ? 'NONCUSTODIAL_SETTLE_PASS' : 'NONCUSTODIAL_SETTLE_FAIL');
  if (!result.pass) process.exitCode = 1;
})().catch((err) => {
  console.error(err?.stack ?? err);
  console.error('NONCUSTODIAL_SETTLE_FAIL');
  process.exit(1);
});
