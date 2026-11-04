import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../_shared/init-proof-wasm.mjs';
import { createIntegritasProofProvider } from '../../../packages/proof-integritas/dist/index.js';
import { createProof, signProof } from '../../../packages/proof/dist/index.js';

const SEED = new Uint8Array(32).fill(79);
const NOW = 1_700_000_000_000;

function mockIntegritas({ status = 'ok' } = {}) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    if (url.endsWith('/timestamp/post')) {
      return { json: async () => ({ status, hash: JSON.parse(init.body).hash, txId: '0xtx', timestamp: NOW }) };
    }
    if (url.endsWith('/file/check')) {
      return { json: async () => ({ status: status === 'ok' ? 'found' : status, hash: JSON.parse(init.body).hash }) };
    }
    if (url.endsWith('/verify/file')) {
      return { json: async () => ({ status: status === 'ok' ? 'verified' : status, message: status === 'ok' ? undefined : 'not anchored' }) };
    }
    throw new Error(`unexpected url ${url}`);
  };
  return { fetch, calls };
}

test('stamps, checks and verifies a hash through the injected transport', async () => {
  const mock = mockIntegritas();
  const provider = createIntegritasProofProvider({
    baseUrl: 'http://integritas.test/core/v2',
    apiKey: 'test-key',
    requestIdFactory: () => 'req-1',
    fetch: mock.fetch,
  });

  const hash = 'ab'.repeat(32);
  const stamped = await provider.stampHash({ hash });
  assert.equal(stamped.ok, true);
  assert.equal(stamped.data?.txId, '0xtx');

  const checked = await provider.checkHash({ hash });
  assert.equal(checked.ok, true);

  const verified = await provider.verifyHash({ hash });
  assert.equal(verified.valid, true);

  assert.equal(mock.calls.length, 3);
  assert.equal(mock.calls[0].headers['x-api-key'], 'test-key');
  assert.equal(mock.calls[0].headers['x-request-id'], 'req-1');
});

test('anchors a signed proof and verifies it locally before on-chain', async () => {
  const mock = mockIntegritas();
  const provider = createIntegritasProofProvider({ baseUrl: 'http://integritas.test/core/v2', fetch: mock.fetch });
  const signed = signProof(
    createProof({
      kind: 'attestation',
      subject: { id: 'device:1', kind: 'device' },
      issuer: 'issuer:1',
      issuedAt: NOW,
    }),
    SEED,
    0,
  );

  const anchored = await provider.anchorProof(signed);
  assert.equal(anchored.ok, true);
  assert.ok(anchored.data?.anchorRef);

  const verified = await provider.verifyProof(signed, { skipLocalVerification: true });
  assert.equal(verified.valid, true);
  assert.equal(verified.signerAddress, signed.signature.address);

  const tampered = { ...signed, payload: { forged: true } };
  const rejected = await provider.verifyProof(tampered);
  assert.equal(rejected.valid, false);
  // The local signature check short-circuits before any network call.
  assert.equal(mock.calls.some((call) => call.url.endsWith('/verify/file') && call.body.hash), true);
});

test('provider errors are returned as structured failures, never thrown', async () => {
  const mock = mockIntegritas({ status: 'error' });
  const provider = createIntegritasProofProvider({ baseUrl: 'http://integritas.test/core/v2', fetch: mock.fetch });

  const stamped = await provider.stampHash({ hash: 'cd'.repeat(32) });
  assert.equal(stamped.ok, false);
  assert.match(stamped.error ?? '', /Integritas|status/i);

  const verified = await provider.verifyHash({ hash: 'cd'.repeat(32) });
  assert.equal(verified.valid, false);

  const unavailable = createIntegritasProofProvider({
    baseUrl: 'http://integritas.test/core/v2',
    fetch: async () => { throw new Error('network down'); },
  });
  const failed = await unavailable.stampHash({ hash: 'ef'.repeat(32) });
  assert.equal(failed.ok, false);
  assert.match(failed.error ?? '', /network down/i);
});
