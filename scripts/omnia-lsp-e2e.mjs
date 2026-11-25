#!/usr/bin/env node
/**
 * Omnia LSP Phase 1 e2e — provider-funded direct open.
 *
 * Exercises the LSP provider facade + omnia-host adapter with the new
 * provider-funded auto-select path:
 *
 *   quote -> provider.open(request) [host selects its own coin]
 *         -> channel active on both hosts
 *         -> consumer pay
 *         -> settle + close
 *
 * Env:
 *   NODE_A / NODE_B          Minima RPC (default http://127.0.0.1:9005 / :9015)
 *   HOST_A / HOST_B          omnia-host JSON-RPC (default :50052/rpc / :50053/rpc)
 *   MINIMA_RPC_PASSWORD      node RPC password (default "test")
 *   RPC_TOKEN                control-plane bearer token (default "test")
 *   B_TRANSPORT_PUBKEY       consumer transport key (0x…); required when whoami omits it
 *   LSP_PROVIDER_ID          provider id (default "prov-moka-launch-1")
 *   LSP_CONSUMER_AMOUNT      consumer initial balance, decimal (default 0.6)
 *   LSP_PROVIDER_AMOUNT      provider initial balance, decimal (default 0.4)
 *   LSP_PAY_AMOUNT           consumer payment, decimal (default 0.05)
 *   LSP_CONTEST_DELAY        contest delay blocks (default 2; test/dev only)
 *   LSP_SETTLE_COINAGE       settlement coinage to wait for (default 2; the
 *                            program's settlement branch requires >= 2)
 *   LSP_NUDGE                "1" to try mining test-chain blocks with tiny txs
 *   LSP_CHANNEL_ID           resume an existing active channel at settle/close
 *
 * Result: prints an `OMNIA_LSP_RESULT {...}` line and `LSP_PASS`.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createOmniaLspProvider, createOmniaHostProviderHost } = require('../packages/omnia-lsp-provider/dist/cjs/index.js');
const { buildScriptProof, amountToAtoms } = require('../packages/core/dist/cjs/index.js');

const NODE_A = process.env.NODE_A ?? 'http://127.0.0.1:9005';
const NODE_B = process.env.NODE_B ?? NODE_A;
const HOST_A = process.env.HOST_A ?? 'http://127.0.0.1:50052/rpc';
const HOST_B = process.env.HOST_B ?? 'http://127.0.0.1:50053/rpc';
const MINIMA_RPC_PASSWORD = process.env.MINIMA_RPC_PASSWORD ?? 'test';
const RPC_TOKEN = process.env.RPC_TOKEN ?? 'test';
const B_TRANSPORT_PUBKEY = process.env.B_TRANSPORT_PUBKEY ?? '';
const RESUME_CHANNEL_ID = process.env.LSP_CHANNEL_ID ?? '';
const SETTLE_COINAGE = Number(process.env.LSP_SETTLE_COINAGE ?? 2);
const PROVIDER_ID = process.env.LSP_PROVIDER_ID ?? 'prov-moka-launch-1';
const CONSUMER_AMOUNT = process.env.LSP_CONSUMER_AMOUNT ?? '0.6';
const PROVIDER_AMOUNT = process.env.LSP_PROVIDER_AMOUNT ?? '0.4';
const PAY_AMOUNT = process.env.LSP_PAY_AMOUNT ?? '0.05';
const CONTEST_DELAY = Number(process.env.LSP_CONTEST_DELAY ?? 2);
const NUDGE = process.env.LSP_NUDGE === '1';
const JSON_ONLY = process.argv.includes('--json');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...args) => { if (!JSON_ONLY) console.log(...args); };

let seq = 0;
async function node(base, command) {
  const res = await fetch(`${base.replace(/\/$/, '')}/`, {
    method: 'POST',
    headers: { authorization: 'Basic ' + Buffer.from(`minima:${MINIMA_RPC_PASSWORD}`).toString('base64') },
    body: command,
    signal: AbortSignal.timeout(60_000),
  });
  const body = await res.json().catch(() => ({}));
  if (body.error) throw new Error(`${command.split(' ')[0]}: ${body.error}`);
  return body.response;
}

async function host(base, method, params = {}, timeoutMs = 300_000) {
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

async function waitFor(label, attempts, delayMs, fn) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    try {
      last = await fn();
      if (last) return last;
    } catch (error) {
      last = error;
    }
    await sleep(delayMs);
  }
  throw new Error(`${label} timed out (${attempts} attempts): ${last}`);
}

async function nudgeBlock() {
  try {
    const address = await node(NODE_A, 'newaddress');
    const target = address?.miniaddress ?? address?.address;
    if (!target) return;
    await node(NODE_A, `send address:${target} amount:0.000000001 mine:true`);
  } catch (error) {
    // Solo chains can have no sendable coin between blocks; the loop retries.
    log('nudge skipped:', error instanceof Error ? error.message : String(error));
  }
}

function manifestFor(who) {
  return {
    version: 'omnia-lsp/v1',
    providerId: PROVIDER_ID,
    identity: { address: who.address },
    service: {
      type: 'omnia-lsp',
      name: 'MOKA Launch Provider',
      version: '0.1.0',
      relayUrl: 'wss://api.axia.to/api/relay/ws',
    },
    channel: {
      partyId: who.identityId,
      publicKeyDigest: who.publicKeyDigest,
      settlementAddress: who.settlementAddress,
    },
    assets: [{
      tokenId: '0x00',
      scale: 0,
      inboundCapacity: '1000',
      outboundCapacity: '1000',
      minChannel: '0.0001',
      maxChannel: '1000',
    }],
    fees: { openBps: 0, leaseBps: 0 },
    terms: { lease: false, jit: false, closePolicy: 'either' },
    custody: { mode: 'self', canMoveFunds: false },
    publishedAt: Date.now(),
    expiresAt: Date.now() + 3_600_000,
    sequence: 1,
    topics: ['omnia', 'lsp'],
  };
}

async function main() {
  const whoA = await host(HOST_A, 'totem_omniaWhoami');
  const whoB = await host(HOST_B, 'totem_omniaWhoami');
  log('provider', whoA.identityId, whoA.publicKeyDigest);
  log('consumer', whoB.identityId, whoB.publicKeyDigest);

  const manifest = manifestFor(whoA);
  const methods = {
    get(name) {
      if (name !== 'totem_omniaOpenChannel' && name !== 'totem_omniaCloseChannel') return undefined;
      return (params) => host(HOST_A, name, params);
    },
  };
  const hostPort = createOmniaHostProviderHost({ methods, operationIdPrefix: 'omnia-lsp-e2e' });
  const provider = createOmniaLspProvider({
    manifest,
    host: hostPort,
    // The host does not verify the quote signature; a real provider signs with
    // its identity key. This e2e exercises channel execution, not signing.
    signQuote: () => `0x${'11'.repeat(64)}`,
  });

  const request = {
    providerId: PROVIDER_ID,
    consumerAddress: whoB.address,
    consumerPartyId: whoB.identityId,
    consumerPublicKeyDigest: whoB.publicKeyDigest,
    ...(whoB.settlementAddress ? { consumerSettlementAddress: whoB.settlementAddress } : {}),
    ...(B_TRANSPORT_PUBKEY ? { consumerTransportPubkey: B_TRANSPORT_PUBKEY } : {}),
    tokenId: '0x00',
    localAmount: CONSUMER_AMOUNT,
    remoteAmount: PROVIDER_AMOUNT,
    direction: 'both',
  };

  const decision = provider.evaluate(request);
  if (!decision.allowed) throw new Error(`provider rejected quote: ${decision.errors.join('; ')}`);

  let channelId;
  let stateA;
  let stateB;

  if (RESUME_CHANNEL_ID) {
    channelId = RESUME_CHANNEL_ID;
    log('resuming', channelId);
    stateA = await host(HOST_A, 'totem_omniaGetChannelState', { channelId });
    stateB = await host(HOST_B, 'totem_omniaGetChannelState', { channelId });
    if (stateA.status !== 'active' || stateB.status !== 'active') {
      throw new Error(`cannot resume: A=${stateA.status} B=${stateB.status}`);
    }
    log('A active', stateA.status, JSON.stringify(stateA.balances));
    log('B active', stateB.status, JSON.stringify(stateB.balances));
  } else {
    // No fundingCoinId: the provider host must select its own sendable coin and
    // build the funding witness from its own wallet/node. Point it at a simple
    // provider address that actually holds a spendable coin.
    const targetAtoms = amountToAtoms(CONSUMER_AMOUNT) + amountToAtoms(PROVIDER_AMOUNT);
    const coins = await node(NODE_A, 'coins');
    const list = Array.isArray(coins) ? coins : (coins?.coins ?? []);
    const fundingCoin = list.find((c) => !c.spent
      && (!c.tokenid || c.tokenid === '0x00')
      && amountToAtoms(String(c.amount)) >= targetAtoms);
    if (!fundingCoin) throw new Error('no provider funding coin covers the channel total');
    log('provider funding address', fundingCoin.address, fundingCoin.amount);
    const opened = await provider.open(request, {
      fundingAddress: fundingCoin.address,
      contestDelayBlocks: CONTEST_DELAY,
    });
    log('open', JSON.stringify(opened));
    if (!opened.success || !opened.channelId) throw new Error(`LSP open failed: ${opened.error ?? 'no channelId'}`);
    channelId = opened.channelId;

    const active = await (async () => {
      for (let i = 0; i < 120; i += 1) {
        const state = await host(HOST_A, 'totem_omniaGetChannelState', { channelId });
        if (state.status === 'active') return state;
        if (NUDGE && i % 4 === 0) await nudgeBlock();
        await sleep(1_000);
      }
      throw new Error('channel active timed out');
    })();
    log('A active', active.status, JSON.stringify(active.balances));
    stateB = await host(HOST_B, 'totem_omniaGetChannelState', { channelId });
    log('B active', stateB.status, JSON.stringify(stateB.balances));
    if (stateB.status !== 'active') throw new Error(`consumer channel is ${stateB.status}`);

    const paid = await host(HOST_B, 'totem_omniaPay', {
      operationId: `lsp-pay-${Date.now()}`,
      channelId,
      amount: PAY_AMOUNT,
    });
    log('pay', JSON.stringify(paid));
    const afterPay = await waitFor('counterparty update', 90, 1_000, async () => {
      const [a, b] = await Promise.all([
        host(HOST_A, 'totem_omniaGetChannelState', { channelId }),
        host(HOST_B, 'totem_omniaGetChannelState', { channelId }),
      ]);
      return a.currentSequence >= 1 && b.currentSequence >= 1 ? { a, b } : null;
    });
    stateA = afterPay.a;
    stateB = afterPay.b;
    log('A seq', stateA.currentSequence, JSON.stringify(stateA.balances));
    log('B seq', stateB.currentSequence, JSON.stringify(stateB.balances));
  }

  // On-chain settlement/refund. The eltoo settlement branch needs coinage >= 2;
  // the test chain only mines when a transaction is posted.
  let created = Number((await node(NODE_A, `coinexport coinid:${stateA.fundingCoinId}`))?.coinproof?.coin?.created ?? 0);
  for (let i = 0; i < 300; i += 1) {
    const tip = await node(NODE_A, 'getchaintip');
    const age = Number(tip.block) - created;
    if (age >= SETTLE_COINAGE) break;
    if (NUDGE && i % 4 === 0) await nudgeBlock();
    await sleep(2_000);
    created = Number((await node(NODE_A, `coinexport coinid:${stateA.fundingCoinId}`))?.coinproof?.coin?.created ?? created);
  }

  const channelExport = await node(NODE_A, `coinexport coinid:${stateA.fundingCoinId}`);
  if (!channelExport?.data) throw new Error('channel coin export missing');
  const scriptProof = buildScriptProof(stateA.fundingScript);
  const settlement = await host(HOST_A, 'totem_omniaSettle', {
    operationId: `lsp-settle-${Date.now()}`,
    channelId,
    broadcastProofs: {
      coinProofs: [channelExport.data],
      scriptProofs: ['0x' + Buffer.from(scriptProof).toString('hex')],
    },
  });
  log('settle', JSON.stringify(settlement));

  const closedA = await provider.close(channelId);
  const closedB = await host(HOST_B, 'totem_omniaCloseChannel', {
    operationId: `lsp-close-b-${Date.now()}`,
    channelId,
  });
  log('close A', JSON.stringify(closedA));
  log('close B', JSON.stringify(closedB));

  const result = {
    stage: 'LSP-1',
    at: new Date().toISOString(),
    channelId,
    provider: whoA.identityId,
    consumer: whoB.identityId,
    consumerInitial: CONSUMER_AMOUNT,
    providerInitial: PROVIDER_AMOUNT,
    payAmount: PAY_AMOUNT,
    sequence: stateB.currentSequence,
    balances: stateB.balances,
    settlementTxId: settlement.settlementTxId ?? settlement.settlementPayload?.txpowId,
    pass: true,
  };
  console.log(`OMNIA_LSP_RESULT ${JSON.stringify(result)}`);
  console.log('LSP_PASS');
}

main().catch((error) => {
  console.error(JSON_ONLY ? JSON.stringify({ stage: 'LSP-1', pass: false, error: String(error) }) : error?.stack ?? error);
  console.error('LSP_FAIL');
  process.exit(1);
});
