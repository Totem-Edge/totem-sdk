import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../_shared/init-proof-wasm.mjs';
import { readFileSync } from 'node:fs';
import { init } from '../../../packages/core/dist/index.js';
import {
  createProof,
  signProof,
  verifyProof,
  verifyProofIdIntegrity,
  verifyProofSignature,
  createAnchorCommitment,
  attachAnchor,
  verifyAnchorRef,
  computeProofId,
  applyOraclePolicy,
  medianAtoms,
  ORACLE_OBSERVATION_DOMAIN,
} from '../../../packages/proof/dist/index.js';

const coreGlue = new URL('../../../packages/core-wasm/pkg-web/totemsdk_core_wasm.js', import.meta.url);
await init({ module_or_path: readFileSync(new URL('./totemsdk_core_wasm_bg.wasm', coreGlue)) });

const SEED = new Uint8Array(32).fill(11);
const ISSUED_AT = 1_700_000_000_000;

function proof(overrides = {}) {
  return createProof({
    kind: 'attestation',
    subject: { id: 'device:1', kind: 'device' },
    issuer: 'issuer:1',
    issuedAt: ISSUED_AT,
    evidence: [{ id: 'ev-1', kind: 'measurement', hash: 'aa'.repeat(32) }],
    ...overrides,
  });
}

test('proofId is deterministic over the unsigned envelope', () => {
  const a = proof();
  const b = proof();
  assert.equal(a.proofId, b.proofId);
  const { proofId, ...unsigned } = a;
  assert.equal(computeProofId(unsigned), proofId);
  assert.equal(verifyProofIdIntegrity({ ...signProof(a, SEED, 0) }), true);
});

test('a signed proof verifies and detects tampering', () => {
  const signed = signProof(proof(), SEED, 0);
  assert.equal(verifyProof(signed, { now: ISSUED_AT + 1000 }).valid, true);
  assert.equal(verifyProofSignature(signed), true);

  const tamperedSubject = { ...signed, subject: { ...signed.subject, id: 'device:2' } };
  assert.equal(verifyProofSignature(tamperedSubject), false);
  assert.equal(verifyProof(tamperedSubject, { now: ISSUED_AT + 1000 }).valid, false);

  const tamperedPayload = { ...signed, payload: { value: 'forged' } };
  assert.equal(verifyProofSignature(tamperedPayload), false);
});

test('expiry is enforced with an explicit grace window', () => {
  const signed = signProof(proof({ expiresAt: ISSUED_AT + 1000 }), SEED, 0);
  assert.equal(verifyProof(signed, { now: ISSUED_AT + 500 }).valid, true);
  const expired = verifyProof(signed, { now: ISSUED_AT + 5000 });
  assert.equal(expired.valid, false);
  assert.equal(expired.expired, true);
  assert.equal(verifyProof(signed, { now: ISSUED_AT + 5000, graceMs: 10_000 }).valid, true);
});

test('the anchor commitment is deterministic and anchor attachment is outside the signed region', () => {
  const signed = signProof(proof(), SEED, 0);
  const commitment = createAnchorCommitment(signed);
  assert.match(commitment, /^[0-9a-f]{64}$/);
  assert.equal(createAnchorCommitment(signed), commitment);

  const anchored = attachAnchor(signed, {
    provider: 'integritas',
    hash: commitment,
    txId: '0xanchor',
    confirmedAt: ISSUED_AT + 2000,
  });
  assert.equal(anchored.proofId, signed.proofId);
  assert.equal(verifyAnchorRef(anchored, anchored.anchor), true);
  assert.equal(verifyAnchorRef(anchored, { ...anchored.anchor, hash: 'ff'.repeat(32) }), false);
  // Attaching an anchor does not invalidate the signature or id.
  assert.equal(verifyProofSignature(anchored), true);
  assert.equal(verifyProofIdIntegrity(anchored), true);
});

test('oracle observation policy enforces quorum, freshness and deviation', () => {
  const now = 1_700_000_010_000;
  const observations = ['a', 'b', 'c'].map((publisherId, index) => ({
    domain: ORACLE_OBSERVATION_DOMAIN,
    feedId: 'minima/usdt:spot',
    publisherId,
    subjectId: 'MINIMA/USDT',
    valueAtoms: ['1000', '1001', '999'][index],
    scale: 0,
    unit: 'usd',
    observedAtMs: now - 1000,
    validUntilMs: now + 60_000,
    sequence: String(index + 1),
    contextHash: '0xctx',
    evidenceHash: '0xev',
  }));
  const policy = {
    feedId: 'minima/usdt:spot',
    unit: 'usd',
    scale: 0,
    authorizedPublishers: ['a', 'b', 'c'],
    minQuorum: 3,
    aggregation: 'median',
    maxAgeMs: 60_000,
    maxFutureDriftMs: 5000,
    maxDeviationBps: 100,
  };

  assert.equal(medianAtoms([1000n, 3000n, 2000n]), 2000n);
  const accepted = applyOraclePolicy(observations, policy, now);
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.set.valueAtoms, '1000');

  const stale = observations.map((observation) => ({ ...observation, observedAtMs: now - 120_000 }));
  assert.equal(applyOraclePolicy(stale, policy, now).accepted, false);

  const divergent = observations.map((observation, index) => ({
    ...observation,
    valueAtoms: index === 2 ? '5000' : observation.valueAtoms,
  }));
  assert.equal(applyOraclePolicy(divergent, policy, now).accepted, false);
});
