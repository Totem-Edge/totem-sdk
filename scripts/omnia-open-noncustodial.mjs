#!/usr/bin/env node
/**
 * RFC-058 non-custodial channel-open harness.
 *
 * Coordinator host A has no seed. The funding coin is owned by a WOTS wallet
 * served by a separate process. A prepare -> wallet sign -> submit round opens
 * the channel; host B accepts the proposal without any signing key.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { signRequestPayload } = require('../packages/omnia/dist/cjs/index.js');
const { buildScriptProof } = require('../packages/core/dist/cjs/index.js');

const HOST_A = process.env.HOST_A ?? 'http://127.0.0.1:50055/rpc';
const HOST_B = process.env.HOST_B ?? 'http://172.31.74.14:50056/rpc';
const NODE = process.env.NODE ?? 'http://127.0.0.1:9029';
const WALLET = process.env.WALLET ?? 'http://127.0.0.1:51060';
const TOKEN = process.env.RPC_TOKEN ?? 'test';
const NODE_PASSWORD = process.env.MINIMA_RPC_PASSWORD ?? 'test';
const FUNDING_COIN_ID = process.env.FUNDING_COIN_ID;
const REMOTE_TRANSPORT = process.env.REMOTE_TRANSPORT;
const LOCAL_AMOUNT = process.env.LOCAL_AMOUNT ?? '60000000';
const REMOTE_AMOUNT = process.env.REMOTE_AMOUNT ?? '40000000';

if (!FUNDING_COIN_ID) throw new Error('FUNDING_COIN_ID is required');
if (!REMOTE_TRANSPORT) throw new Error('REMOTE_TRANSPORT is required');

let seq = 0;
async function rpc(base, method, params = {}) {
  const res = await fetch(base, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++seq, method, params }),
    signal: AbortSignal.timeout(120000),
  });
  const body = await res.json().catch(() => ({}));
  if (body.error) throw new Error(`${method}: ${body.error.message ?? JSON.stringify(body.error)}`);
  return body.result;
}

async function wallet(path, body) {
  const res = await fetch(`${WALLET.replace(/\/$/, '')}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`wallet ${path}: ${json.error ?? res.status}`);
  return json;
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

const hex = (bytes) => '0x' + Buffer.from(bytes).toString('hex');
const digestBytes = (value) => value instanceof Uint8Array
  ? value
  : Uint8Array.from(Object.values(value ?? {}));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const whoA = await rpc(HOST_A, 'totem_omniaWhoami');
  const whoB = await rpc(HOST_B, 'totem_omniaWhoami');
  if (!whoA.identityId || !whoB.identityId) throw new Error('both coordinator identities must be configured');
  const walletInfo = await wallet('/info');
  const exported = await node(`coinexport coinid:${FUNDING_COIN_ID}`);
  if (!exported?.data) throw new Error('funding coin export missing');

  const prepared = await rpc(HOST_A, 'totem_omniaPrepareOpenChannel', {
    operationId: `noncust-open-${Date.now()}`,
    remotePartyId: whoB.identityId,
    remotePublicKeyDigest: whoB.publicKeyDigest,
    remoteAddressIndex: 0,
    remoteSettlementAddress: whoB.settlementAddress ?? whoB.address,
    remoteTransportPubkey: REMOTE_TRANSPORT,
    localAmount: LOCAL_AMOUNT,
    remoteAmount: REMOTE_AMOUNT,
    fundingCoinId: FUNDING_COIN_ID,
    fundingScript: walletInfo.fundingScript,
    contestDelayBlocks: 2,
  });

  const intent = { ...prepared.requests.intent, digest: digestBytes(prepared.requests.intent.digest) };
  const fundingDigest = digestBytes(prepared.requests.funding.digest);
  const reservation = await wallet('/lease/reserve', {
    params: {
      treeId: `noncust-open-${prepared.channelId}`,
      purpose: 'channel-funding',
      payloadHash: hex(fundingDigest),
    },
  });
  const indices = reservation.indices;
  const intentSignature = await wallet('/sign', {
    digest: hex(signRequestPayload(intent)),
    indices,
  });
  const fundingSignature = await wallet('/sign', {
    digest: hex(fundingDigest),
    indices,
  });

  const submitted = await rpc(HOST_A, 'totem_omniaSubmitOpenChannel', {
    operationId: `noncust-submit-${Date.now()}`,
    preparedOperationId: prepared.operationId,
    intentSignature: intentSignature.signature,
    fundingSignature: fundingSignature.signature,
    fundingCoinProofsHex: [exported.data],
    fundingScriptProofsHex: [hex(buildScriptProof(walletInfo.fundingScript))],
  });

  if (submitted.fundingTxId) {
    await wallet('/lease/commit', {
      reservationId: reservation.reservationId,
      txId: submitted.fundingTxId,
    });
  }

  let state;
  for (let i = 0; i < 90; i += 1) {
    state = await rpc(HOST_B, 'totem_omniaGetChannelState', { channelId: submitted.channelId }).catch(() => null);
    if (state?.status === 'active') break;
    await sleep(1000);
  }
  const result = {
    stage: 'NONCUSTODIAL_OPEN',
    at: new Date().toISOString(),
    channelId: submitted.channelId,
    fundingTxId: submitted.fundingTxId,
    acknowledged: submitted.acknowledged,
    hostAHasSeed: false,
    hostBHasSeed: false,
    walletPublicKeyDigest: walletInfo.publicKeyDigest,
    balances: state?.balances,
    pass: state?.status === 'active',
  };
  console.log(`OMNIA_RESULT ${JSON.stringify(result)}`);
  console.log(result.pass ? 'NONCUSTODIAL_OPEN_PASS' : 'NONCUSTODIAL_OPEN_FAIL');
  if (!result.pass) process.exitCode = 1;
})().catch((err) => {
  console.error(err?.stack ?? err);
  console.error('NONCUSTODIAL_OPEN_FAIL');
  process.exit(1);
});
