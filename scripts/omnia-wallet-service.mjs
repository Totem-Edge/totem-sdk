#!/usr/bin/env node
/**
 * RFC-058 non-custodial test wallet service.
 *
 * Holds the channel seed and WOTS lease journal in a separate process. The
 * coordinator host only reaches this service over loopback HTTP and never
 * receives OMNIA_HOST_SEED.
 *
 * Env:
 *   OMNIA_WALLET_SEED  BIP39 mnemonic or 32-byte hex seed
 *   OMNIA_WALLET_DB    SQLite path used for the lease journal
 *   OMNIA_WALLET_PORT  loopback port (default 51060)
 *   OMNIA_WALLET_TOKEN optional bearer token
 */
import http from 'node:http';
import { mmrRootFromSingleLeaf, scriptFromWotsPk } from '../packages/core/dist/cjs/index.js';
import { createHostSigning } from '../packages/omnia-host/dist/signing.js';
import { loadConfigFromEnv } from '../packages/omnia-host/dist/config.js';

const seed = process.env.OMNIA_WALLET_SEED;
const dbPath = process.env.OMNIA_WALLET_DB;
const port = Number(process.env.OMNIA_WALLET_PORT ?? 51060);
const token = process.env.OMNIA_WALLET_TOKEN;
if (!seed) throw new Error('OMNIA_WALLET_SEED is required');
if (!dbPath) throw new Error('OMNIA_WALLET_DB is required');

const signing = createHostSigning(loadConfigFromEnv({
  OMNIA_HOST_SEED: seed,
  OMNIA_HOST_DB: dbPath,
}));
const fundingScript = scriptFromWotsPk(signing.treeKey.getPublicKey());
const addressHex = '0x' + Buffer.from(mmrRootFromSingleLeaf(fundingScript)).toString('hex');

const hex = (bytes) => '0x' + Buffer.from(bytes).toString('hex');

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

const server = http.createServer(async (req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  try {
    if (token && req.headers.authorization !== `Bearer ${token}`) return send(401, { error: 'unauthorized' });
    if (req.method === 'GET' && req.url === '/info') {
      return send(200, {
        publicKeyDigest: signing.publicKeyDigest,
        transportPubkey: signing.transportPubkey,
        transportKeyPair: {
          publicKey: hex(signing.transportKeyPair.publicKey),
          secretKey: hex(signing.transportKeyPair.secretKey),
        },
        address: signing.address,
        addressHex,
        fundingScript,
        addressIndex: signing.addressIndex,
      });
    }
    if (req.method !== 'POST') return send(404, { error: 'not found' });
    const body = await readJson(req);
    if (req.url === '/sign') {
      const digest = Uint8Array.from(Buffer.from(String(body.digest).replace(/^0x/i, ''), 'hex'));
      const signature = await signing.signer.sign(digest, body.indices);
      return send(200, { signature: hex(signature) });
    }
    if (req.url === '/lease/reserve') {
      return send(200, await signing.leaseProvider.reserveKeyUse(body.params));
    }
    if (req.url === '/lease/commit') {
      await signing.leaseProvider.commitKeyUse(body.reservationId, body.txId);
      return send(200, { ok: true });
    }
    if (req.url === '/lease/burn') {
      await signing.leaseProvider.burnReservation(body.reservationId, body.reason);
      return send(200, { ok: true });
    }
    if (req.url === '/lease/watermark') {
      return send(200, await signing.leaseProvider.getLocalWatermark(body.treeId));
    }
    if (req.url === '/lease/publish') {
      await signing.leaseProvider.publishWatermark(body.treeId);
      return send(200, { ok: true });
    }
    if (req.url === '/lease/sync') {
      return send(200, await signing.leaseProvider.syncLeaseJournal());
    }
    if (req.url === '/lease/verify') {
      return send(200, { valid: await signing.leaseProvider.verifyLeaseCertificate(body.cert) });
    }
    return send(404, { error: 'not found' });
  } catch (err) {
    return send(500, { error: err instanceof Error ? err.message : String(err) });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[wallet] ${signing.publicKeyDigest} listening on 127.0.0.1:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
