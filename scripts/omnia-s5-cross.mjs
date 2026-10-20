#!/usr/bin/env node
/**
 * S5 — factory + virtual-channel lifecycle across two hosts.
 *
 *   createFactory -> openVirtualChannel -> closeVirtualChannel
 *
 * The initiator (HOST_A) drives both control planes; the counterparty accepts
 * over its Omnia transport (relay or native Hyperswarm, depending on the host
 * environment). The hosts return their transport pubkey in the signed manifest.
 *
 * Env:
 *   HOST_A / HOST_B   omnia-host JSON-RPC (default private OCI addresses)
 *   RPC_TOKEN         control-plane bearer token (default "test")
 *   OMNIA_TRANSPORT   label for the result (relay | native | other)
 *
 * Flags:
 *   --json            only print the final result JSON
 *
 * Result: prints an `OMNIA_RESULT {...}` line; use it to update
 * docs/OMNIA_TEST_RESULTS.md.
 */
const A = process.env.HOST_A ?? 'http://10.0.0.210:50052/rpc';
const B = process.env.HOST_B ?? 'http://10.0.0.55:50053/rpc';
const TOKEN = process.env.RPC_TOKEN ?? 'test';
const TRANSPORT = process.env.OMNIA_TRANSPORT ?? 'unknown';
const JSON_ONLY = process.argv.includes('--json');
const CONTRIBUTION = process.env.OMNIA_S5_CONTRIBUTION ?? '100000000';
const VC_AMOUNT = process.env.OMNIA_S5_VC_AMOUNT ?? '50000000';

const log = (...args) => { if (!JSON_ONLY) console.log(...args); };
let seq = 0;

async function rpc(base, method, params = {}, timeoutMs = 120_000) {
  const id = ++seq;
  const t0 = Date.now();
  const res = await fetch(base, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await res.json().catch(() => ({}));
  const ms = Date.now() - t0;
  if (body.error) {
    throw new Error(`${method} failed after ${ms}ms: ${body.error.message ?? JSON.stringify(body.error)}`);
  }
  log(`  ${method} ok (${ms}ms)`);
  return body.result;
}

function findTransport(manifest) {
  let found;
  const walk = (value) => {
    if (!value || typeof value !== 'object' || found) return;
    if (typeof value.transportPubkey === 'string') { found = value.transportPubkey; return; }
    for (const child of Object.values(value)) walk(child);
  };
  walk(manifest);
  return found;
}

async function identity(base) {
  const who = await rpc(base, 'totem_omniaWhoami');
  const man = await rpc(base, 'totem_omniaGetManifest');
  return {
    partyId: who.identityId,
    publicKeyDigest: who.publicKeyDigest,
    transportPubkey: findTransport(man?.manifest),
  };
}

function participant(id, contributionAmount) {
  return {
    partyId: id.partyId,
    publicKeyDigest: id.publicKeyDigest,
    addressIndex: 0,
    contributionAmount,
    ...(id.transportPubkey ? { transportPubkey: id.transportPubkey } : {}),
  };
}

const op = (name) => `${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

async function main() {
  const a = await identity(A);
  const b = await identity(B);
  log('A', a.partyId, a.transportPubkey ?? '(no transport pubkey)');
  log('B', b.partyId, b.transportPubkey ?? '(no transport pubkey)');

  const factory = await rpc(A, 'totem_omniaCreateFactory', {
    operationId: op('factory'),
    tokenId: '0x00',
    participants: [participant(a, CONTRIBUTION), participant(b, CONTRIBUTION)],
  });
  if (!factory.factoryId) throw new Error(`no factoryId: ${JSON.stringify(factory)}`);
  log('factory', factory.factoryId, factory.status);

  const vc = await rpc(A, 'totem_omniaOpenVirtualChannel', {
    operationId: op('vc-open'),
    factoryId: factory.factoryId,
    partyIds: [a.partyId, b.partyId],
    amounts: { [a.partyId]: VC_AMOUNT, [b.partyId]: VC_AMOUNT },
  });
  if (!vc.channelId) throw new Error(`no channelId: ${JSON.stringify(vc)}`);
  log('vc', vc.channelId);

  const closed = await rpc(A, 'totem_omniaCloseVirtualChannel', {
    operationId: op('vc-close'),
    factoryId: factory.factoryId,
    channelId: vc.channelId,
  });
  if (!closed.allocations) throw new Error(`close returned no allocations: ${JSON.stringify(closed)}`);
  const expected = BigInt(CONTRIBUTION).toString();
  for (const partyId of [a.partyId, b.partyId]) {
    if (closed.allocations[partyId] !== expected) {
      throw new Error(`allocation mismatch for ${partyId}: ${closed.allocations[partyId]} !== ${expected}`);
    }
  }
  log('closed', JSON.stringify(closed.allocations));

  for (const [label, base] of [['A', A], ['B', B]]) {
    const channels = await rpc(base, 'totem_omniaGetChannels');
    log(`channels ${label}`, JSON.stringify(channels));
  }

  const result = {
    stage: 'S5',
    at: new Date().toISOString(),
    transport: TRANSPORT,
    hosts: { A, B },
    factoryId: factory.factoryId,
    channelId: vc.channelId,
    allocations: closed.allocations,
    pass: true,
  };
  console.log(`OMNIA_RESULT ${JSON.stringify(result)}`);
  console.log('S5_PASS');
}

main().catch((err) => {
  console.error(JSON_ONLY ? JSON.stringify({ stage: 'S5', pass: false, error: String(err) }) : err?.stack ?? err);
  console.error('S5_FAIL');
  process.exit(1);
});
