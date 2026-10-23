#!/usr/bin/env node
/** Seven-hop expired-HTLC timeout/refund test. */
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { sha3_256 } = require('../packages/core/dist/cjs/index.js');

const TOKEN = process.env.RPC_TOKEN ?? 'test';
const HOSTS = ['A','B','C','D','E','F','G','H'].map((name) => ({
  name,
  url: process.env[`HOST_${name}`] ?? `http://127.0.0.1:${50052 + 'ABCDEFGH'.indexOf(name)}/rpc`,
}));
const CHANNELS = (process.env.CHANNELS ?? '').split(',').filter(Boolean);
const AMOUNT = BigInt(process.env.AMOUNT ?? '1000000');
const TIMEOUT = BigInt(process.env.TIMEOUT ?? '1');
if (CHANNELS.length !== 7) throw new Error('CHANNELS must contain 7 IDs');
let seq = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hex = (b) => '0x' + Buffer.from(b).toString('hex');
async function rpc(host, method, params = {}) {
  const res = await fetch(host.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++seq, method, params }),
    signal: AbortSignal.timeout(120000),
  });
  const body = await res.json().catch(() => ({}));
  if (body.error) throw new Error(`${host.name} ${method}: ${body.error.message ?? JSON.stringify(body.error)}`);
  return body.result;
}
const state = (host, channelId) => rpc(host, 'totem_omniaGetChannelState', { channelId });
async function pending(host, channelId, htlcId, status) {
  const s = await state(host, channelId);
  return (s.pendingHTLCs ?? []).find((h) => h.htlcId === htlcId && h.status === status);
}
async function waitFor(label, fn) {
  let last;
  for (let i = 0; i < 60; i += 1) {
    last = await fn().catch((e) => e);
    if (last && !(last instanceof Error)) return last;
    await sleep(500);
  }
  throw new Error(`${label} timeout: ${last instanceof Error ? last.message : JSON.stringify(last)}`);
}

(async () => {
  const who = [];
  for (const h of HOSTS) who.push(await rpc(h, 'totem_omniaWhoami'));
  const preimage = crypto.randomBytes(32);
  const hashlock = hex(sha3_256(preimage));
  const locked = [];
  for (let i = 0; i < 7; i += 1) {
    const added = await rpc(HOSTS[i], 'totem_omniaAddHTLC', {
      operationId: `timeout7-add-${i}-${Date.now()}`,
      channelId: CHANNELS[i], amount: AMOUNT.toString(), hashlock,
      timeoutBlock: TIMEOUT.toString(), direction: 'offered',
      counterpartPublicKeyDigest: who[i + 1].publicKeyDigest,
    });
    locked.push(added.htlcId);
    await waitFor(`${HOSTS[i + 1].name} sees expired HTLC ${i}`, () => pending(HOSTS[i + 1], CHANNELS[i], added.htlcId, 'pending'));
  }
  for (let i = 0; i < 7; i += 1) {
    await rpc(HOSTS[i], 'totem_omniaTimeoutHTLC', {
      operationId: `timeout7-${i}-${Date.now()}`, channelId: CHANNELS[i], htlcId: locked[i],
    });
    await waitFor(`${HOSTS[i + 1].name} sees timeout ${i}`, () => pending(HOSTS[i + 1], CHANNELS[i], locked[i], 'timed_out'));
  }
  const final = {};
  for (let i = 0; i < 7; i += 1) final[`${HOSTS[i].name}-${HOSTS[i + 1].name}`] = (await state(HOSTS[i], CHANNELS[i])).balances;
  const result = { stage: 'S8_HOST_HTLC7_TIMEOUT', at: new Date().toISOString(), channels: CHANNELS, hops: 7, final, pass: true };
  console.log(`OMNIA_RESULT ${JSON.stringify(result)}`);
  console.log('S8_HOST_HTLC7_TIMEOUT_PASS');
})().catch((e) => { console.error(e?.stack ?? e); console.error('S8_HOST_HTLC7_TIMEOUT_FAIL'); process.exit(1); });
