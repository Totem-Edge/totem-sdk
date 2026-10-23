#!/usr/bin/env node
/** Non-custodial 7-hop HTLC across eight coordinator hosts. */
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { sha3_256 } = require('../packages/core/dist/cjs/index.js');

const TOKEN = process.env.RPC_TOKEN ?? 'test';
const HOSTS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((name) => ({
  name,
  url: process.env[`HOST_${name}`] ?? `http://127.0.0.1:${50052 + 'ABCDEFGH'.indexOf(name)}/rpc`,
}));
const CHANNELS = (process.env.CHANNELS ?? '').split(',').filter(Boolean);
const AMOUNT = BigInt(process.env.AMOUNT ?? '1000000');
const FEE = BigInt(process.env.FEE ?? '10000');
const TIMEOUT = BigInt(process.env.TIMEOUT ?? '500000');
if (CHANNELS.length !== 7) throw new Error('CHANNELS must contain 7 channel IDs');

let seq = 0;
async function rpc(host, method, params = {}) {
  const res = await fetch(host.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++seq, method, params }),
    signal: AbortSignal.timeout(180000),
  });
  const body = await res.json().catch(() => ({}));
  if (body.error) throw new Error(`${host.name} ${method}: ${body.error.message ?? JSON.stringify(body.error)}`);
  return body.result;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(label, fn, attempts = 60, delay = 500) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    try {
      last = await fn();
      if (last) return last;
    } catch (err) {
      last = err;
    }
    await sleep(delay);
  }
  throw new Error(`${label} timeout: ${last instanceof Error ? last.message : JSON.stringify(last)}`);
}
const hex = (u8) => '0x' + Buffer.from(u8).toString('hex');
const state = (host, channelId) => rpc(host, 'totem_omniaGetChannelState', { channelId });
const pending = (host, channelId, htlcId, status) =>
  state(host, channelId).then((s) => (s.pendingHTLCs ?? []).find((h) => h.htlcId === htlcId && h.status === status));

(async () => {
  const who = [];
  for (const host of HOSTS) who.push(await rpc(host, 'totem_omniaWhoami'));
  const preimage = crypto.randomBytes(32);
  const hashlock = hex(sha3_256(preimage));
  const locked = [];

  for (let i = 0; i < 7; i += 1) {
    const host = HOSTS[i];
    const next = HOSTS[i + 1];
    const amount = AMOUNT - FEE * BigInt(i);
    const added = await rpc(host, 'totem_omniaAddHTLC', {
      operationId: `htlc7-${i}-${Date.now()}`,
      channelId: CHANNELS[i],
      amount: amount.toString(),
      hashlock,
      timeoutBlock: (TIMEOUT + BigInt(7 - i)).toString(),
      direction: 'offered',
      counterpartPublicKeyDigest: who[i + 1].publicKeyDigest,
    });
    locked.push({ htlcId: added.htlcId, amount });
    await waitFor(`${next.name} sees hop ${i}`, () => pending(next, CHANNELS[i], added.htlcId, 'pending'));
    console.log(`hop ${i} ${host.name}->${next.name} locked ${added.htlcId} ${amount}`);
  }

  for (let i = 6; i >= 0; i -= 1) {
    const host = HOSTS[i + 1];
    const previous = HOSTS[i];
    await rpc(host, 'totem_omniaFulfillHTLC', {
      operationId: `htlc7-fulfill-${i}-${Date.now()}`,
      channelId: CHANNELS[i],
      htlcId: locked[i].htlcId,
      preimage: hex(preimage),
    });
    await waitFor(`${previous.name} sees hop ${i} fulfilled`, () => pending(previous, CHANNELS[i], locked[i].htlcId, 'fulfilled'));
    console.log(`hop ${i} fulfilled by ${host.name}`);
  }

  const final = {};
  for (let i = 0; i < 7; i += 1) {
    const s = await state(HOSTS[i], CHANNELS[i]);
    final[`${HOSTS[i].name}-${HOSTS[i + 1].name}`] = s.balances;
  }
  const result = {
    stage: 'S8_HOST_HTLC7_NONCUSTODIAL',
    at: new Date().toISOString(),
    channels: CHANNELS,
    amount: AMOUNT.toString(),
    fee: FEE.toString(),
    hops: 7,
    final,
    pass: true,
  };
  console.log(`OMNIA_RESULT ${JSON.stringify(result)}`);
  console.log('S8_HOST_HTLC7_PASS');
})().catch((err) => {
  console.error(err?.stack ?? err);
  console.error('S8_HOST_HTLC7_FAIL');
  process.exit(1);
});
