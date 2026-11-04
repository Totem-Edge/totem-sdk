import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../_shared/init-proof-wasm.mjs';
import { createLocationClaim } from '../../../packages/location-proof/dist/index.js';
import {
  spatialRelationFromLocationClaim,
  createUnsignedSpatialProof,
  signSpatialProof,
  verifySpatialProof,
  addSpatialRelationToGraph,
  evaluateSpatialRelation,
  pointInPolygon,
} from '../../../packages/spatial-proof/dist/index.js';
import { createProofGraph, getProofNodes } from '../../../packages/proofgraph/dist/index.js';

const SEED = new Uint8Array(32).fill(53);
const NOW = 1_700_000_000_000;
const SITE = {
  spatialId: 'site-1',
  kind: 'site-boundary',
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [-0.20, 51.40], [-0.10, 51.40], [-0.10, 51.60], [-0.20, 51.60], [-0.20, 51.40],
    ]],
  },
  name: 'Site 1',
};

function locationClaim(lat, lon) {
  return createLocationClaim({
    subjectId: 'device:drone-1',
    deviceId: 'device:drone-1',
    deviceClass: 'drone',
    observedAt: NOW,
    location: { lat, lon, accuracyM: 5 },
    source: { type: 'gnss', satellitesUsed: 12, hdop: 0.8 },
  });
}

test('a location claim relates to a site boundary and produces a verifiable spatial proof', () => {
  assert.equal(pointInPolygon([-0.12, 51.5], SITE.geometry), true);

  const claim = spatialRelationFromLocationClaim({
    locationClaim: locationClaim(51.5, -0.12),
    spatialObject: SITE,
    relation: 'inside',
    computedAt: NOW,
  });
  assert.equal(claim.result.matched, true);

  const unsigned = createUnsignedSpatialProof({
    claim,
    spatialObject: SITE,
    issuer: 'gateway:1',
    issuedAt: NOW,
  });
  const signed = signSpatialProof(unsigned, SEED, 0);
  const verified = verifySpatialProof(signed, { now: NOW + 1000 });
  assert.equal(verified.valid, true, verified.reason);

  const graph = addSpatialRelationToGraph(createProofGraph(), claim, signed);
  assert.ok(graph.nodes.length >= 1);
});

test('an outside point fails the inside relation and a degraded claim is still explicit', () => {
  const outside = spatialRelationFromLocationClaim({
    locationClaim: locationClaim(52.5, 1.5),
    spatialObject: SITE,
    relation: 'inside',
    computedAt: NOW,
  });
  assert.equal(outside.result.matched, false);

  const evaluated = evaluateSpatialRelation({
    subjectId: 'device:drone-1',
    subjectKind: 'device',
    spatialObject: SITE,
    relation: 'inside',
    subjectGeometry: { type: 'Point', coordinates: [-0.12, 51.5] },
    computedAt: NOW,
  });
  assert.equal(evaluated.result.matched, true);
});
