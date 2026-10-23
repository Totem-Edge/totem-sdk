#!/usr/bin/env node
/**
 * RFC-058 non-custodial test host.
 *
 * Runs omnia-host as a coordinator: no OMNIA_HOST_SEED, no local lease journal.
 * Signing and WOTS reservations are delegated to a separate wallet service over
 * loopback HTTP. Only the transport key is materialised in this process.
 */
import { createOmniaHost } from '../packages/omnia-host/dist/lifecycle.js';
import { loadConfigFromEnv } from '../packages/omnia-host/dist/config.js';

const walletUrl = process.env.OMNIA_WALLET_URL;
const walletToken = process.env.OMNIA_WALLET_TOKEN;
if (!walletUrl) throw new Error('OMNIA_WALLET_URL is required');
if (process.env.OMNIA_HOST_SEED || process.env.OMNIA_HOST_KEYFILE) {
  throw new Error('non-custodial host refuses OMNIA_HOST_SEED/OMNIA_HOST_KEYFILE');
}

async function wallet(path, body) {
  const res = await fetch(`${walletUrl.replace(/\/$/, '')}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(walletToken ? { authorization: `Bearer ${walletToken}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`wallet ${path}: ${json.error ?? res.status}`);
  return json;
}

const info = await wallet('/info');
const hex = (value) => Uint8Array.from(Buffer.from(String(value).replace(/^0x/i, ''), 'hex'));

const signer = {
  publicKeyDigest: info.publicKeyDigest,
  sign: async (payload, indices) => hex((await wallet('/sign', {
    digest: '0x' + Buffer.from(payload).toString('hex'),
    indices,
  })).signature),
};

const leaseProvider = {
  reserveKeyUse: (params) => wallet('/lease/reserve', { params }),
  commitKeyUse: async (reservationId, txId) => { await wallet('/lease/commit', { reservationId, txId }); },
  burnReservation: async (reservationId, reason) => { await wallet('/lease/burn', { reservationId, reason }); },
  getLocalWatermark: (treeId) => wallet('/lease/watermark', { treeId }),
  publishWatermark: async (treeId) => { await wallet('/lease/publish', { treeId }); },
  syncLeaseJournal: () => wallet('/lease/sync', {}),
  verifyLeaseCertificate: async (cert) => (await wallet('/lease/verify', { cert })).valid,
};

const config = loadConfigFromEnv();
const host = createOmniaHost(config, {
  signer,
  leaseProvider,
  transportKeyPair: {
    publicKey: hex(info.transportKeyPair.publicKey),
    secretKey: hex(info.transportKeyPair.secretKey),
  },
  transportPubkey: info.transportPubkey,
  localParticipant: {
    partyId: config.localPartyId,
    publicKeyDigest: info.publicKeyDigest,
    addressIndex: info.addressIndex,
    settlementAddress: info.addressHex ?? info.address,
    transportPubkey: info.transportPubkey,
  },
  identity: {
    address: info.address,
    publicKeyDigest: info.publicKeyDigest,
    identityId: config.localPartyId,
  },
});

await host.start();
console.log(`[noncustodial] ${info.publicKeyDigest} coordinator on ${config.port}`);

let closing = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    if (closing) return;
    closing = true;
    await host.close();
    process.exit(0);
  });
}
await new Promise(() => {});
