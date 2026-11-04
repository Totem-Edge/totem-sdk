import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../_shared/init-proof-wasm.mjs';
import {
  createLocationClaim,
  scoreLocationClaim,
  createUnsignedLocationProof,
  signLocationProof,
  verifyLocationProof,
  addLocationProofToGraph,
  distanceMeters,
} from '../../../packages/location-proof/dist/index.js';
import {
  createProofGraph,
  getProofNodes,
  findProofsBySubject,
} from '../../../packages/proofgraph/dist/index.js';

const SEED = new Uint8Array(32).fill(41);
const NOW = 1_700_000_000_000;

function claim(overrides = {}) {
  return createLocationClaim({
    subjectId: 'device:gnss-1',
    deviceId: 'device:gnss-1',
    deviceClass: 'drone',
    observedAt: NOW,
    location: { lat: 51.5, lon: -0.12, altitudeM: 30, accuracyM: 4 },
    source: { type: 'gnss', fixType: 'rtk-fixed', satellitesUsed: 14, hdop: 0.7 },
    ...overrides,
  });
}

test('a GNSS claim scores, signs into a proof and indexes into a proof graph', () => {
  const located = claim();
  const score = scoreLocationClaim(located);
  assert.ok(score.score > 0);
  assert.ok(['moderate', 'strong', 'high'].includes(score.level));

  const unsigned = createUnsignedLocationProof({ claim: located, issuer: 'gateway:1', issuedAt: NOW });
  const signed = signLocationProof(unsigned, SEED, 0);
  const verified = verifyLocationProof(signed, { now: NOW + 1000 });
  assert.equal(verified.valid, true, verified.reason);

  let graph = createProofGraph({ label: 'gnss-evidence' });
  graph = addLocationProofToGraph(graph, signed);
  assert.equal(getProofNodes(graph).length, 1);
  assert.equal(findProofsBySubject(graph, 'device:gnss-1').length, 1);
});

test('confidence falls when the fix degrades and impossible jumps are detected', () => {
  const strong = scoreLocationClaim(claim());
  const weak = scoreLocationClaim(claim({
    location: { lat: 51.5, lon: -0.12, accuracyM: 250 },
    source: { type: 'cell', satellitesUsed: 2, hdop: 8, spoofingFlag: true },
  }));
  assert.ok(weak.score < strong.score);
  assert.ok(weak.negativeSignals.length > 0);

  const distance = distanceMeters({ lat: 51.5, lon: -0.12 }, { lat: 51.501, lon: -0.12 });
  assert.ok(distance > 100 && distance < 120);
});

test('a stale location proof fails verification at a later time', () => {
  const unsigned = createUnsignedLocationProof({
    claim: claim(),
    issuer: 'gateway:1',
    issuedAt: NOW,
    expiresAt: NOW + 1000,
  });
  const signed = signLocationProof(unsigned, SEED, 1);
  assert.equal(verifyLocationProof(signed, { now: NOW + 500 }).valid, true);
  assert.equal(verifyLocationProof(signed, { now: NOW + 60_000 }).valid, false);
});
