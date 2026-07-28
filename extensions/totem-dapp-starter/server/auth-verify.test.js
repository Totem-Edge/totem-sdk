'use strict';

/**
 * Tests for POST /api/auth/verify.
 *
 * Run with: node --test server/auth-verify.test.js
 *
 * In TOTEM_CONNECT v4.1, TOTEM_VERIFY signs from the connected spend
 * address's per-address TreeKey, so `deriveAddress(publicKey) === address`
 * holds. The handler verifies proofs with @totemsdk/core's
 * verifySignatureDetailed(address, message, signature, publicKey) one-liner.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');

const { app, ready } = require('./index');

let server;
let baseUrl;
let validProof;

before(async () => {
  // Wait for the session store (Redis or in-memory) to finish initializing
  // before any request is made — the handler returns 503 if sessionStore
  // is still undefined when a request lands.
  await ready;

  // Spin up the test server.
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;

  // Build a real WOTS proof. We use a tiny TreeKey (1 level × 4 keys) so the
  // test stays fast — the production handler accepts any depth ≥ 1.
  const sdk = await import('@totemsdk/core');
  const seed = new Uint8Array(32);
  for (let i = 0; i < seed.length; i++) seed[i] = i + 1;

  const tk = new sdk.TreeKey(seed, 4, 1);
  tk.setUses(0);

  const message = `Login to example.com at ${new Date().toISOString()}`;
  const digest = new Uint8Array(crypto.createHash('sha3-256').update(message, 'utf8').digest());
  const treeSig = tk.sign(digest);
  const sigBytes = sdk.serializeTreeSignature(treeSig);
  const pkBytes = tk.getPublicKey();

  const toHex = (u8) => '0x' + Buffer.from(u8).toString('hex');
  const publicKeyHex = toHex(pkBytes);

  // v4.1: the proof's publicKey IS the spend address's root public key, so
  // the claimed `address` must be the address derived from publicKey.
  const address = sdk.deriveAddressFromPublicKey(publicKeyHex);

  validProof = {
    address,
    publicKey: publicKeyHex,
    signature: toHex(sigBytes),
    message,
  };
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function postVerify(body) {
  const res = await fetch(`${baseUrl}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, body: json };
}

test('v4.1 binding invariant: deriveAddressFromPublicKey(publicKey) === address', async () => {
  // Task #83: in v4.1 TOTEM_VERIFY signs from the connected spend address,
  // so the proof's publicKey IS the spend address's root public key. This
  // invariant is what lets backends use the verifySignatureDetailed
  // one-liner — the helper re-derives the address from publicKey and
  // compares it to the claimed address. If this binding ever broke, every
  // backend in the ecosystem would start rejecting valid proofs.
  const sdk = await import('@totemsdk/core');
  const derived = sdk.deriveAddressFromPublicKey(validProof.publicKey);
  assert.equal(derived, validProof.address);
});

test('v4.1 response shape contains no legacy authKeyIndex or digestHex fields', async () => {
  const { body } = await postVerify(validProof);
  assert.equal(body.success, true);
  // The v4.1 starter contract intentionally drops these v4.0 fields.
  assert.equal(body.authKeyIndex, undefined);
  assert.equal(body.digestHex, undefined);
});

test('accepts a real WOTS proof signed from the spend address', async () => {
  const { status, body } = await postVerify(validProof);
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(body.address, validProof.address);
  assert.equal(typeof body.sessionToken, 'string');
});

test('rejects when the claimed address does not match the publicKey', async () => {
  const wrongAddress = 'MxG000000000000000000000000000000000000000000000000000000';
  const { status, body } = await postVerify({ ...validProof, address: wrongAddress });
  assert.equal(status, 401);
  assert.equal(body.success, false);
  assert.match(body.error, /Signature verification failed/);
});

test('rejects when message is tampered (signature no longer matches)', async () => {
  const { status, body } = await postVerify({ ...validProof, message: validProof.message + ' (tampered)' });
  assert.equal(status, 401);
  assert.equal(body.success, false);
  assert.match(body.error, /Signature verification failed/);
});

test('rejects when publicKey does not match the signing key', async () => {
  const otherPk = '0x' + 'aa'.repeat(32);
  const { status, body } = await postVerify({ ...validProof, publicKey: otherPk });
  assert.equal(status, 401);
  assert.equal(body.success, false);
  assert.match(body.error, /Signature verification failed/);
});

test('rejects when signature hex is malformed', async () => {
  const { status, body } = await postVerify({ ...validProof, signature: '0xnothex' });
  assert.equal(status, 401);
  assert.equal(body.success, false);
  assert.match(body.error, /Signature verification failed/);
});

test('rejects when publicKey is not 32 bytes', async () => {
  const { status, body } = await postVerify({ ...validProof, publicKey: '0xabcd' });
  assert.equal(status, 401);
  assert.equal(body.success, false);
  assert.match(body.error, /Signature verification failed/);
});

test('returns 400 for missing required fields', async () => {
  const { status, body } = await postVerify({ address: 'MxABCD1234' });
  assert.equal(status, 400);
  assert.equal(body.success, false);
  assert.match(body.error, /Missing verification fields/);
});
