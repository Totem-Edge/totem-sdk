/**
 * @totemsdk/proof-integritas — Test suite
 *
 * All tests use a mock fetch injected via config.fetch.
 * Zero real network calls are made.
 *
 * Test inventory:
 *  1  createIntegritasProofProvider returns object with all 9 capabilities
 *  2  stampHash sends POST to correct URL with correct headers and body
 *  3  checkHash sends correct shape to /file/check
 *  4  verifyHash sends correct shape to /verify/file
 *  5  verifyHash with reportRequired:true sets x-report-required header
 *  6  normalizeIntegritasStampResponse maps success and failure correctly
 *  7  anchorProof computes createAnchorCommitment hash and stamps it
 *  8  verifyProof returns {valid:false} without calling fetch when local verify fails
 *  9  network errors return {ok:false} / {valid:false} without throwing
 * 10  all named exports are present in root index
 */

import {
  createIntegritasProofProvider,
  normalizeIntegritasStampResponse,
  normalizeIntegritasCheckResponse,
  normalizeIntegritasVerifyResponse,
  integritasHashFromProof,
  integritasAnchorRefFromResponse,
} from '../index';

import * as IntegritasModule from '../index';
import { createProof, signProof, createAnchorCommitment } from '@totemsdk/proof';
import type { SignedProof } from '@totemsdk/proof';

const SEED_A = new Uint8Array(32).fill(0xaa);

function makeSignedProof(overrides?: { subjectId?: string }): SignedProof {
  const unsigned = createProof({
    kind: 'attestation',
    subject: {
      id: overrides?.subjectId ?? 'totem:subject:test-integritas',
      kind: 'device',
    },
    issuer: 'totem:issuer:integritas-test',
  });
  return signProof(unsigned, SEED_A, 0);
}

function mockFetch(responseBody: unknown, status = 200): jest.Mock {
  return jest.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(responseBody),
  });
}

// ─── Test 1: capabilities ─────────────────────────────────────────────────────

test('(1) createIntegritasProofProvider returns object with all 9 capabilities', () => {
  const provider = createIntegritasProofProvider({ fetch: mockFetch({}) });

  const expected = [
    'hash:stamp',
    'hash:check',
    'hash:verify',
    'proof:anchor',
    'proof:check',
    'proof:verify',
    'report:pdf',
    'nft:trace',
    'minima:onchain',
  ];

  expect(provider.capabilities).toHaveLength(9);
  for (const cap of expected) {
    expect(provider.capabilities).toContain(cap);
  }
});

// ─── Test 2: stampHash sends correct request ──────────────────────────────────

test('(2) stampHash sends POST to /timestamp/post with correct headers and body', async () => {
  const fetch = mockFetch({ status: 'ok', hash: 'deadbeef', txId: 'tx-001' });
  const provider = createIntegritasProofProvider({
    fetch,
    apiKey: 'test-key-123',
    requestIdFactory: () => 'fixed-request-id',
    baseUrl: 'https://test.integritas.io/core/v2',
  });

  await provider.stampHash!({ hash: 'abc123' });

  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, init] = fetch.mock.calls[0] as [string, RequestInit];

  expect(url).toBe('https://test.integritas.io/core/v2/timestamp/post');
  expect(init.method).toBe('POST');

  const headers = init.headers as Record<string, string>;
  expect(headers['x-api-key']).toBe('test-key-123');
  expect(headers['x-request-id']).toBe('fixed-request-id');
  expect(headers['Content-Type']).toBe('application/json');

  expect(JSON.parse(init.body as string)).toEqual({ hash: 'abc123' });
});

// ─── Test 3: checkHash sends correct request ──────────────────────────────────

test('(3) checkHash sends correct shape to /file/check', async () => {
  const fetch = mockFetch({ status: 'ok', hash: 'abc', txId: 'tx-002' });
  const provider = createIntegritasProofProvider({
    fetch,
    requestIdFactory: () => 'req-id-check',
    baseUrl: 'https://test.integritas.io/core/v2',
  });

  await provider.checkHash!({ hash: 'myhash' });

  const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('https://test.integritas.io/core/v2/file/check');
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body as string)).toEqual({ hash: 'myhash' });
});

// ─── Test 4: verifyHash sends correct request ─────────────────────────────────

test('(4) verifyHash sends correct shape to /verify/file', async () => {
  const fetch = mockFetch({ status: 'verified' });
  const provider = createIntegritasProofProvider({
    fetch,
    requestIdFactory: () => 'req-id-verify',
    baseUrl: 'https://test.integritas.io/core/v2',
  });

  await provider.verifyHash!({ hash: 'verifyhash' });

  const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('https://test.integritas.io/core/v2/verify/file');
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body as string)).toEqual({ hash: 'verifyhash' });

  const headers = init.headers as Record<string, string>;
  expect(headers['x-report-required']).toBeUndefined();
});

// ─── Test 5: reportRequired header ────────────────────────────────────────────

test('(5) verifyHash with reportRequired:true sets x-report-required header', async () => {
  const fetch = mockFetch({ status: 'verified' });
  const provider = createIntegritasProofProvider({
    fetch,
    requestIdFactory: () => 'req-id-report',
    baseUrl: 'https://test.integritas.io/core/v2',
  });

  await provider.verifyHash!({ hash: 'reporthash', reportRequired: true });

  const [, init] = fetch.mock.calls[0] as [string, RequestInit];
  const headers = init.headers as Record<string, string>;
  expect(headers['x-report-required']).toBe('true');
});

// ─── Test 6: normalization functions ──────────────────────────────────────────

test('(6) normalizeIntegritasStampResponse maps success and failure correctly', () => {
  const success = normalizeIntegritasStampResponse({
    status: 'ok',
    hash: 'aabbcc',
    txId: 'tx-stamp-1',
    timestamp: 1700000000,
  });
  expect(success.ok).toBe(true);
  expect((success.data as Record<string, unknown>)['hash']).toBe('aabbcc');
  expect((success.data as Record<string, unknown>)['txId']).toBe('tx-stamp-1');
  expect(success.providerRef).toBe('integritas');

  const failure = normalizeIntegritasStampResponse({
    status: 'error',
    message: 'Hash already exists',
  });
  expect(failure.ok).toBe(false);
  expect(failure.error).toContain('Hash already exists');

  const checkResult = normalizeIntegritasCheckResponse({ status: 'ok', hash: 'xyz' });
  expect(checkResult.ok).toBe(true);

  const checkFail = normalizeIntegritasCheckResponse({ status: 'not_found', message: 'not found' });
  expect(checkFail.ok).toBe(false);

  const verifyOk = normalizeIntegritasVerifyResponse({ status: 'verified' });
  expect(verifyOk.valid).toBe(true);

  const verifyFail = normalizeIntegritasVerifyResponse({
    status: 'unverified',
    message: 'hash not found on chain',
  });
  expect(verifyFail.valid).toBe(false);
  expect(verifyFail.reason).toContain('hash not found on chain');
});

// ─── Test 7: anchorProof uses createAnchorCommitment hash ─────────────────────

test(
  '(7) anchorProof computes createAnchorCommitment hash and stamps it',
  async () => {
    const sp = makeSignedProof();
    const expectedHash = createAnchorCommitment(sp);

    const fetch = mockFetch({
      status: 'ok',
      hash: expectedHash,
      txId: 'tx-anchor-1',
    });
    const provider = createIntegritasProofProvider({
      fetch,
      requestIdFactory: () => 'req-id-anchor',
    });

    const result = await provider.anchorProof!(sp);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { hash: string };

    expect(body.hash).toBe(expectedHash);
    expect(result.ok).toBe(true);

    const data = result.data as Record<string, unknown>;
    expect(data['anchorRef']).toBeDefined();
    expect((data['anchorRef'] as Record<string, unknown>)['provider']).toBe('integritas');
  },
  30000,
);

// ─── Test 8: local verify fails → no fetch call ───────────────────────────────

test(
  '(8) verifyProof returns {valid:false} without calling fetch when local verify fails',
  async () => {
    const sp = makeSignedProof();
    const tampered: SignedProof = {
      ...sp,
      subject: { ...sp.subject, id: 'totem:subject:tampered-subject' },
    };

    const fetch = mockFetch({ status: 'verified' });
    const provider = createIntegritasProofProvider({
      fetch,
      requestIdFactory: () => 'req-id-local-fail',
    });

    const result = await provider.verifyProof!(tampered);

    expect(fetch).not.toHaveBeenCalled();
    expect(result.valid).toBe(false);
  },
  30000,
);

// ─── Test 9: network errors return structured failures ────────────────────────

test('(9) network errors return {ok:false}/{valid:false} without throwing', async () => {
  const throwingFetch = jest.fn().mockRejectedValue(new Error('Network unreachable'));
  const provider = createIntegritasProofProvider({
    fetch: throwingFetch as unknown as typeof globalThis.fetch,
    requestIdFactory: () => 'req-id-error',
  });

  const stamp = await provider.stampHash!({ hash: 'xyz' });
  expect(stamp.ok).toBe(false);
  expect(stamp.error).toBeTruthy();

  const check = await provider.checkHash!({ hash: 'xyz' });
  expect(check.ok).toBe(false);

  const verify = await provider.verifyHash!({ hash: 'xyz' });
  expect(verify.valid).toBe(false);
  expect(verify.reason).toBeTruthy();
});

// ─── Test 10: all named exports present ──────────────────────────────────────

test('(10) all named exports are present in root index', () => {
  const required = [
    'createIntegritasProofProvider',
    'normalizeIntegritasStampResponse',
    'normalizeIntegritasCheckResponse',
    'normalizeIntegritasVerifyResponse',
    'integritasHashFromProof',
    'integritasAnchorRefFromResponse',
  ] as const;

  for (const name of required) {
    expect(typeof (IntegritasModule as Record<string, unknown>)[name]).toBe('function');
  }
});
