#!/usr/bin/env node
/** 3-host real HTLC path: A -> B -> C over two independent host channels. */
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { sha3_256 } = require('../packages/core/dist/cjs/index.js');

const TOKEN = process.env.RPC_TOKEN ?? 'test';
const A = process.env.HOST_A ?? 'http://3.237.11.213:50052/rpc';
const B = process.env.HOST_B ?? 'http://100.49.46.155:50053/rpc';
const C = process.env.HOST_C ?? 'http://98.80.220.62:50054/rpc';
const CHANNEL_AB = process.env.CHANNEL_AB;
const CHANNEL_BC = process.env.CHANNEL_BC;
const AMOUNT = BigInt(process.env.PAY_AMOUNT ?? '1000000');
const FEE = BigInt(process.env.HOP_FEE ?? '10000');
const TIMEOUT = BigInt(process.env.HTLC_TIMEOUT ?? '500000');
let seq = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hex = (b) => '0x' + Buffer.from(b).toString('hex');

async function rpc(base, method, params = {}) {
  const res = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` }, body: JSON.stringify({ jsonrpc: '2.0', id: ++seq, method, params }), signal: AbortSignal.timeout(120000) });
  const body = await res.json().catch(() => ({}));
  if (body.error) throw new Error(`${method}: ${body.error.message ?? JSON.stringify(body.error)}`);
  return body.result;
}
async function waitFor(label, tries, ms, fn) {
  let last;
  for (let i = 0; i < tries; i++) { try { const v = await fn(); if (v) return v; last = v; } catch (e) { last = e; } await sleep(ms); }
  throw new Error(`${label} timeout: ${last instanceof Error ? last.message : JSON.stringify(last)}`);
}
const state = async (base, channelId) => rpc(base, 'totem_omniaGetChannelState', { channelId });
const pending = async (base, channelId, htlcId, status) => {
  const s = await state(base, channelId);
  return (s.channel?.pendingHTLCs ?? s.pendingHTLCs ?? []).find((h) => h.htlcId === htlcId && h.status === status);
};

(async () => {
  if (!CHANNEL_AB || !CHANNEL_BC) throw new Error('CHANNEL_AB and CHANNEL_BC are required');
  const whoA = await rpc(A, 'totem_omniaWhoami');
  const whoB = await rpc(B, 'totem_omniaWhoami');
  const whoC = await rpc(C, 'totem_omniaWhoami');
  const preimage = crypto.randomBytes(32);
  const hashlock = hex(sha3_256(preimage));

  const a = await rpc(A, 'totem_omniaAddHTLC', {
    operationId: `htlc-a-${Date.now()}`,
    channelId: CHANNEL_AB, amount: AMOUNT.toString(), hashlock,
    timeoutBlock: (TIMEOUT + 2n).toString(), direction: 'offered',
    counterpartPublicKeyDigest: whoB.publicKeyDigest,
  });
  console.log('A locked', a.htlcId);
  await waitFor('B sees A->B HTLC', 30, 500, () => pending(B, CHANNEL_AB, a.htlcId, 'pending'));

  const b = await rpc(B, 'totem_omniaAddHTLC', {
    operationId: `htlc-b-${Date.now()}`,
    channelId: CHANNEL_BC, amount: (AMOUNT - FEE).toString(), hashlock,
    timeoutBlock: (TIMEOUT + 1n).toString(), direction: 'offered',
    counterpartPublicKeyDigest: whoC.publicKeyDigest,
  });
  console.log('B locked', b.htlcId);
  await waitFor('C sees B->C HTLC', 30, 500, () => pending(C, CHANNEL_BC, b.htlcId, 'pending'));

  await rpc(C, 'totem_omniaFulfillHTLC', { operationId: `htlc-c-${Date.now()}`, channelId: CHANNEL_BC, htlcId: b.htlcId, preimage: hex(preimage) });
  await waitFor('B sees C fulfilled', 30, 500, () => pending(B, CHANNEL_BC, b.htlcId, 'fulfilled'));

  await rpc(B, 'totem_omniaFulfillHTLC', { operationId: `htlc-b2-${Date.now()}`, channelId: CHANNEL_AB, htlcId: a.htlcId, preimage: hex(preimage) });
  await waitFor('A sees B fulfilled', 30, 500, () => pending(A, CHANNEL_AB, a.htlcId, 'fulfilled'));

  const sa = await state(A, CHANNEL_AB);
  const sb = await state(B, CHANNEL_AB);
  const sc = await state(C, CHANNEL_BC);
  const result = {
    stage: 'S8_HOST_HTLC', at: new Date().toISOString(),
    channels: { ab: CHANNEL_AB, bc: CHANNEL_BC },
    amount: AMOUNT.toString(), fee: FEE.toString(),
    parties: { A: whoA.identityId, B: whoB.identityId, C: whoC.identityId },
    final: { ab: sa.channel?.balances ?? sa.balances, bc: sc.channel?.balances ?? sc.balances },
    pass: true,
  };
  console.log(`OMNIA_RESULT ${JSON.stringify(result)}`);
  console.log('S8_HOST_HTLC_PASS');
})().catch((e) => { console.error(e?.stack ?? e); console.error('S8_HOST_HTLC_FAIL'); process.exit(1); });
