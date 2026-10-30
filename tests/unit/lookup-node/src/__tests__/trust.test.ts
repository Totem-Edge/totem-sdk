/**
 * TrustIndex signature-verification tests (AUD-035).
 *
 * Covers the fail-closed default: a TRUST_RECORD is only persisted when a real
 * verifier is configured AND approves AND the reviewer is bound to the
 * authenticated session key. Also covers the explicit legacy opt-out and the
 * end-to-end session path.
 */

import type { TrustRecordMessage } from '@totemsdk/lookup-protocol';
import { LookupNode } from '../node.js';
import { TrustIndex } from '../trust.js';
import { SqliteStore } from '../storage.js';
import { makeMockProvider, connectTestClient } from './helpers.js';

const AUTH_KEY = '00'.repeat(32);

function makeRecord(
  overrides: Partial<TrustRecordMessage['payload']> = {},
): TrustRecordMessage['payload'] {
  return {
    subjectId: 'subject-1',
    rating: 4,
    comment: 'good',
    reviewerAddress: AUTH_KEY,
    signature: 'ab'.repeat(32),
    ...overrides,
  };
}

function makeTrustMessage(payload: TrustRecordMessage['payload'] = makeRecord()): TrustRecordMessage {
  return { type: 'TRUST_RECORD', version: 1, id: 'tr-1', payload };
}

describe('TrustIndex signature verification (AUD-035)', () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = new SqliteStore(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  it('fails closed when no verifier is configured (default requireVerifiedSignature)', async () => {
    const ti = new TrustIndex(store);
    const accepted = await ti.record(makeTrustMessage(), AUTH_KEY);
    expect(accepted).toBe(false);
    expect(store.trustQuery('subject-1')).toHaveLength(0);
  });

  it('rejects when the verifier rejects the signature', async () => {
    const ti = new TrustIndex(store, {
      enabled: true,
      verifyReviewerSignature: () => false,
    });
    const accepted = await ti.record(makeTrustMessage(), AUTH_KEY);
    expect(accepted).toBe(false);
    expect(store.trustQuery('subject-1')).toHaveLength(0);
  });

  it('rejects when the signature is empty even if the verifier approves', async () => {
    const verifier = jest.fn(async () => true);
    const ti = new TrustIndex(store, { enabled: true, verifyReviewerSignature: verifier });
    const accepted = await ti.record(makeTrustMessage(makeRecord({ signature: '' })), AUTH_KEY);
    expect(accepted).toBe(false);
    expect(verifier).not.toHaveBeenCalled();
    expect(store.trustQuery('subject-1')).toHaveLength(0);
  });

  it('accepts and persists when the verifier approves and reviewer matches the session key', async () => {
    const verifier = jest.fn(async () => true);
    const ti = new TrustIndex(store, { enabled: true, verifyReviewerSignature: verifier });
    const accepted = await ti.record(makeTrustMessage(), AUTH_KEY);
    expect(accepted).toBe(true);
    expect(verifier).toHaveBeenCalledWith(
      expect.objectContaining({ reviewerAddress: AUTH_KEY }),
      AUTH_KEY,
    );
    const rows = store.trustQuery('subject-1');
    expect(rows).toHaveLength(1);
    expect(rows[0].rating).toBe(4);
  });

  it('rejects when reviewerAddress does not match the authenticated session key', async () => {
    const verifier = jest.fn(async () => true);
    const ti = new TrustIndex(store, { enabled: true, verifyReviewerSignature: verifier });
    const accepted = await ti.record(
      makeTrustMessage(makeRecord({ reviewerAddress: 'ff'.repeat(32) })),
      AUTH_KEY,
    );
    expect(accepted).toBe(false);
    expect(verifier).not.toHaveBeenCalled();
    expect(store.trustQuery('subject-1')).toHaveLength(0);
  });

  it('legacy mode accepts non-empty signatures without a verifier when opted out', async () => {
    const ti = new TrustIndex(store, { enabled: true, requireVerifiedSignature: false });
    const accepted = await ti.record(makeTrustMessage());
    expect(accepted).toBe(true);
    expect(store.trustQuery('subject-1')).toHaveLength(1);
  });

  it('clamps accepted ratings to [0, 5]', async () => {
    const ti = new TrustIndex(store, { enabled: true, verifyReviewerSignature: () => true });
    await ti.record(makeTrustMessage(makeRecord({ rating: 9 })), AUTH_KEY);
    expect(store.trustQuery('subject-1')[0].rating).toBe(5);
  });
});

describe('TrustIndex over an authenticated session (AUD-035 integration)', () => {
  it('persists a verified TRUST_RECORD and serves it via TRUST_QUERY', async () => {
    const verifier = jest.fn(async () => true);
    const node = new LookupNode({
      provider: makeMockProvider(),
      _skipAuth: true,
      trustIndex: { enabled: true, verifyReviewerSignature: verifier },
    });
    await node.start();
    const { buffer, clientTransport } = await connectTestClient(node);

    buffer.send(clientTransport, makeTrustMessage());
    await new Promise((r) => setTimeout(r, 30));

    expect(verifier).toHaveBeenCalled();
    expect(node.store.trustQuery('subject-1')).toHaveLength(1);

    buffer.send(clientTransport, {
      type: 'TRUST_QUERY',
      version: 1,
      id: 'tq-1',
      payload: { subjectId: 'subject-1', subjectType: 'node' },
    });
    const response = await buffer.waitFor(
      (m) => m.type === 'TRUST_RESPONSE' && m.id === 'tq-1',
    );
    expect(response.payload).toMatchObject({ count: 1, avgRating: 4 });

    await node.stop();
  });

  it('drops unverified TRUST_RECORDs by default', async () => {
    const node = new LookupNode({
      provider: makeMockProvider(),
      _skipAuth: true,
      trustIndex: { enabled: true },
    });
    await node.start();
    const { buffer, clientTransport } = await connectTestClient(node);

    buffer.send(clientTransport, makeTrustMessage());
    await new Promise((r) => setTimeout(r, 30));

    expect(node.store.trustQuery('subject-1')).toHaveLength(0);
    await node.stop();
  });
});
