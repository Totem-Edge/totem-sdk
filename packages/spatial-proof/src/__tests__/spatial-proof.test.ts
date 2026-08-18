/**
 * @totemsdk/spatial-proof — test suite
 *
 * All tests use fixed timestamps and deterministic inputs. No test depends
 * on Date.now() unless time is explicitly injected.
 */

import {
  canonicalJson,
  computeGeometryHash,
  computeSpatialObjectId,
  computeSpatialRelationId,
  hashSpatialObject,
  hashSpatialRelationClaim,
  validateCoordinate,
  validateGeometry,
  validateSpatialObject,
  getBoundingBox,
  bboxIntersects,
  bboxCovers,
  distanceMeters,
  distancePointToLineStringMeters,
  pointInPolygon,
  pointInMultiPolygon,
  isPointNearBoundary,
  evaluateSpatialRelation,
  spatialRelationFromLocationClaim,
  spatialObjectToEvidenceRef,
  spatialRelationToEvidenceRef,
  createUnsignedSpatialProof,
  signSpatialProof,
  verifySpatialProof,
  spatialObjectToProofGraphNode,
  spatialRelationToProofGraphNode,
  spatialRelationToGraphEdges,
} from '../index';
import type {
  Coordinate,
  GeoPolygonGeometry,
  GeoLineStringGeometry,
  GeoMultiPolygonGeometry,
  SpatialObject,
  SpatialRelationClaim,
} from '../index';
import type { LocationClaim } from '@totemsdk/location-proof';
import type { SignedProof, UnsignedProof } from '@totemsdk/proof';

function testSeed(n: number): Uint8Array {
  const s = new Uint8Array(32);
  s[0] = n & 0xff;
  s[1] = (n >> 8) & 0xff;
  return s;
}

const SEED = testSeed(11);
const T0 = 1_700_000_000_000;

// ── Fixtures ────────────────────────────────────────────────────────────────

const SQUARE_POLYGON: GeoPolygonGeometry = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
      [0, 0],
    ],
  ],
};

const SITE_BOUNDARY: SpatialObject = {
  spatialId: 'totem:spatial:site-001',
  kind: 'site-boundary',
  geometry: SQUARE_POLYGON,
  crs: 'EPSG:4326',
  name: 'Site 001',
};

const ROUTE: GeoLineStringGeometry = {
  type: 'LineString',
  coordinates: [
    [0, 0],
    [0, 0.01],
  ],
};

function makeClaim(partial: Partial<SpatialRelationClaim> = {}): SpatialRelationClaim {
  const claim = evaluateSpatialRelation({
    subjectId: 'device:drone-001',
    subjectKind: 'device',
    spatialObject: SITE_BOUNDARY,
    relation: 'inside',
    subjectGeometry: { type: 'Point', coordinates: [0.5, 0.5] },
    computedAt: T0,
  });
  return { ...claim, ...partial };
}

// ── 1. coordinate validation rejects bad lon/lat ────────────────────────────

describe('validateCoordinate', () => {
  it('accepts valid [lon, lat]', () => {
    expect(validateCoordinate([0, 0]).valid).toBe(true);
    expect(validateCoordinate([180, -90]).valid).toBe(true);
    expect(validateCoordinate([-180, 90]).valid).toBe(true);
  });

  it('rejects out-of-range lon and lat', () => {
    expect(validateCoordinate([181, 0]).valid).toBe(false);
    expect(validateCoordinate([-181, 0]).valid).toBe(false);
    expect(validateCoordinate([0, 91]).valid).toBe(false);
    expect(validateCoordinate([0, -91]).valid).toBe(false);
  });

  it('rejects non-finite coordinates', () => {
    expect(validateCoordinate([NaN, 0]).valid).toBe(false);
    expect(validateCoordinate([0, Infinity]).valid).toBe(false);
  });
});

describe('validateGeometry / validateSpatialObject', () => {
  it('rejects unclosed polygon rings', () => {
    const unclosed: GeoPolygonGeometry = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [0, 1],
          [1, 1],
          [1, 0],
        ],
      ],
    };
    expect(validateGeometry(unclosed).valid).toBe(false);
    expect(validateSpatialObject({ ...SITE_BOUNDARY, geometry: unclosed }).valid).toBe(false);
  });

  it('normalizes a ring deterministically', async () => {
    const { normalizePolygonRing } = await import('../index');
    const ring: Coordinate[] = [
      [0, 0],
      [0, 1],
      [1, 1],
    ];
    const closed = normalizePolygonRing(ring);
    expect(closed[closed.length - 1]).toEqual([0, 0]);
    expect(ring.length).toBe(3); // input not mutated
    const again = normalizePolygonRing(ring);
    expect(closed).toEqual(again);
  });

  it('warns for non-EPSG:4326 CRS', () => {
    const obj: SpatialObject = { ...SITE_BOUNDARY, crs: 'EPSG:3857' };
    const result = validateSpatialObject(obj);
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

// ── 2. geometry hash deterministic ──────────────────────────────────────────

describe('computeGeometryHash', () => {
  it('is deterministic for identical geometry', () => {
    const a = computeGeometryHash(SQUARE_POLYGON);
    const b = computeGeometryHash(SQUARE_POLYGON);
    expect(a).toBe(b);
    expect(a.startsWith('totem:geo:')).toBe(true);
    expect(a.length).toBe('totem:geo:'.length + 64);
  });

  it('differs for different geometry', () => {
    const moved: GeoPolygonGeometry = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [0, 1],
          [2, 1],
          [2, 0],
          [0, 0],
        ],
      ],
    };
    expect(computeGeometryHash(moved)).not.toBe(computeGeometryHash(SQUARE_POLYGON));
  });
});

// ── 3. spatial object ID deterministic ──────────────────────────────────────

describe('computeSpatialObjectId', () => {
  it('is deterministic and stable across metadata', () => {
    const id = computeSpatialObjectId({
      kind: 'site-boundary',
      geometry: SQUARE_POLYGON,
      crs: 'EPSG:4326',
      name: 'Site 001',
    });
    expect(id.startsWith('totem:spatial:')).toBe(true);
    const withMetadata = computeSpatialObjectId({
      kind: 'site-boundary',
      geometry: SQUARE_POLYGON,
      crs: 'EPSG:4326',
      name: 'Site 001',
      metadata: { anything: 'ignored' },
    });
    expect(withMetadata).toBe(id);
    expect(hashSpatialObject(SITE_BOUNDARY)).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ── 4/5. point-in-polygon true/false ────────────────────────────────────────

describe('pointInPolygon', () => {
  it('returns true for a point inside', () => {
    expect(pointInPolygon([0.5, 0.5], SQUARE_POLYGON)).toBe(true);
  });

  it('returns false for a point outside', () => {
    expect(pointInPolygon([5, 5], SQUARE_POLYGON)).toBe(false);
    expect(pointInPolygon([-1, 0.5], SQUARE_POLYGON)).toBe(false);
  });

  it('works with MultiPolygon', () => {
    const multi: GeoMultiPolygonGeometry = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [0, 0],
            [0, 1],
            [1, 1],
            [1, 0],
            [0, 0],
          ],
        ],
        [
          [
            [10, 10],
            [10, 11],
            [11, 11],
            [11, 10],
            [10, 10],
          ],
        ],
      ],
    };
    expect(pointInMultiPolygon([0.5, 0.5], multi)).toBe(true);
    expect(pointInMultiPolygon([10.5, 10.5], multi)).toBe(true);
    expect(pointInMultiPolygon([5, 5], multi)).toBe(false);
  });
});

// ── 6. point near boundary ──────────────────────────────────────────────────

describe('isPointNearBoundary', () => {
  it('detects a point near the polygon boundary', () => {
    // 0.0001 deg ≈ 11 m at the equator; threshold 50 m
    expect(isPointNearBoundary([0.0001, 0.5], SQUARE_POLYGON, 50)).toBe(true);
    expect(isPointNearBoundary([0.0001, 0.5], SQUARE_POLYGON, 5)).toBe(false);
  });
});

// ── 7. Haversine distance sanity check ─────────────────────────────────────

describe('distanceMeters', () => {
  it('returns ~111 km per degree of latitude', () => {
    const d = distanceMeters([0, 0], [0, 1]);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it('returns 0 for identical points', () => {
    expect(distanceMeters([1, 2], [1, 2])).toBe(0);
  });
});

// ── 8. distance to route sanity check ──────────────────────────────────────

describe('distancePointToLineStringMeters', () => {
  it('returns ~0 for a point on the route', () => {
    const d = distancePointToLineStringMeters([0, 0.005], ROUTE);
    expect(d).toBeLessThan(1);
  });

  it('returns a positive distance for an offset point', () => {
    // 0.001 deg lon offset at lat 0 ≈ 111 m
    const d = distancePointToLineStringMeters([0.001, 0.005], ROUTE);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(125);
  });
});

// ── 9. bbox intersection true/false ─────────────────────────────────────────

describe('bboxIntersects', () => {
  it('detects overlapping boxes', () => {
    expect(bboxIntersects({ minLon: 0, minLat: 0, maxLon: 2, maxLat: 2 }, { minLon: 1, minLat: 1, maxLon: 3, maxLat: 3 })).toBe(true);
  });

  it('detects disjoint boxes', () => {
    expect(bboxIntersects({ minLon: 0, minLat: 0, maxLon: 1, maxLat: 1 }, { minLon: 2, minLat: 2, maxLon: 3, maxLat: 3 })).toBe(false);
  });
});

// ── 10. bbox cover true/false ───────────────────────────────────────────────

describe('bboxCovers', () => {
  it('detects containment', () => {
    expect(bboxCovers({ minLon: 0, minLat: 0, maxLon: 10, maxLat: 10 }, { minLon: 1, minLat: 1, maxLon: 2, maxLat: 2 })).toBe(true);
  });

  it('rejects a box that is not covered', () => {
    expect(bboxCovers({ minLon: 0, minLat: 0, maxLon: 2, maxLat: 2 }, { minLon: 1, minLat: 1, maxLon: 3, maxLat: 3 })).toBe(false);
  });
});

// ── 11. relation claim ID deterministic ─────────────────────────────────────

describe('computeSpatialRelationId', () => {
  it('is deterministic for identical input', () => {
    const claim = makeClaim();
    const a = computeSpatialRelationId(claim);
    const b = computeSpatialRelationId(claim);
    expect(a).toBe(b);
    expect(a.startsWith('totem:spatial:')).toBe(true);
    expect(a).toBe(claim.relationId);
  });

  it('excludes only relationId and metadata from the hash', () => {
    const claim = makeClaim();
    const withMetadata = makeClaim({ metadata: { note: 'anything' } });
    expect(computeSpatialRelationId(withMetadata)).toBe(claim.relationId);
    expect(hashSpatialRelationClaim(claim)).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ── 12. uncertainty appears for approximate bbox relation ──────────────────

describe('evaluateSpatialRelation — bbox relations', () => {
  it('returns an explicit uncertainty note for bbox-only relations', () => {
    const claim = evaluateSpatialRelation({
      subjectId: 'sat:scene-001',
      subjectKind: 'scene',
      spatialObject: SITE_BOUNDARY,
      relation: 'covers',
      subjectGeometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-1, -1],
            [-1, 2],
            [2, 2],
            [2, -1],
            [-1, -1],
          ],
        ],
      },
      computedAt: T0,
    });
    expect(claim.result.matched).toBe(true);
    expect(claim.result.uncertainty?.some((u) => u.includes('bounding-box'))).toBe(true);
  });

  it('returns a negative result when bbox does not cover', () => {
    const claim = evaluateSpatialRelation({
      subjectId: 'sat:scene-001',
      subjectKind: 'scene',
      spatialObject: SITE_BOUNDARY,
      relation: 'covers',
      subjectGeometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0.2, 0.2],
            [0.2, 0.8],
            [0.8, 0.8],
            [0.8, 0.2],
            [0.2, 0.2],
          ],
        ],
      },
      computedAt: T0,
    });
    expect(claim.result.matched).toBe(false);
  });
});

// ── 13. spatial relation from location claim ───────────────────────────────

describe('spatialRelationFromLocationClaim', () => {
  const locationClaim: LocationClaim = {
    claimId: 'totem:location:abc123',
    subjectId: 'device:drone-001',
    deviceId: 'drone-001',
    deviceClass: 'drone',
    observedAt: T0,
    location: { lat: 0.5, lon: 0.5, accuracyM: 3 },
    source: { type: 'gps', satellitesUsed: 12 },
  };

  it('derives an inside relation from a location claim', () => {
    const claim = spatialRelationFromLocationClaim({
      locationClaim,
      spatialObject: SITE_BOUNDARY,
      relation: 'inside',
      computedAt: T0,
    });
    expect(claim.result.matched).toBe(true);
    expect(claim.inputs.locationClaimId).toBe(locationClaim.claimId);
    expect(claim.subjectKind).toBe('location-claim');
  });

  it('derives an outside relation for a claim outside the boundary', () => {
    const claim = spatialRelationFromLocationClaim({
      locationClaim: { ...locationClaim, location: { lat: 5, lon: 5 } },
      spatialObject: SITE_BOUNDARY,
      relation: 'inside',
      computedAt: T0,
    });
    expect(claim.result.matched).toBe(false);
  });
});

// ── 14. evidence refs include correct hashes ───────────────────────────────

describe('evidence refs', () => {
  it('includes the correct relation and object hashes', () => {
    const claim = makeClaim();
    const relationRef = spatialRelationToEvidenceRef(claim);
    const objectRef = spatialObjectToEvidenceRef(SITE_BOUNDARY);
    expect(relationRef.id).toBe(claim.relationId);
    expect(relationRef.kind).toBe('spatial-relation');
    expect(relationRef.hash).toBe(hashSpatialRelationClaim(claim));
    expect(objectRef.id).toBe(SITE_BOUNDARY.spatialId);
    expect(objectRef.kind).toBe('spatial-object');
    expect(objectRef.hash).toBe(hashSpatialObject(SITE_BOUNDARY));
  });
});

// ── 15. unsigned spatial proof created correctly ───────────────────────────

describe('createUnsignedSpatialProof', () => {
  it('creates an attestation proof with the claim in the payload', () => {
    const claim = makeClaim();
    const proof = createUnsignedSpatialProof({
      claim,
      spatialObject: SITE_BOUNDARY,
      issuer: 'MxISSUER',
      issuedAt: T0,
    }) as UnsignedProof;
    expect(proof.kind).toBe('attestation');
    expect(proof.issuer).toBe('MxISSUER');
    expect(proof.subject.id).toBe('device:drone-001');
    const payload = proof.payload?.['spatialRelation'] as SpatialRelationClaim;
    expect(payload.relationId).toBe(claim.relationId);
    expect(proof.evidence?.some((e) => e.kind === 'spatial-relation')).toBe(true);
    expect(proof.evidence?.some((e) => e.kind === 'spatial-object')).toBe(true);
  });
});

// ── 16/17. signed spatial proof verifies / tampered fails ──────────────────

describe('signSpatialProof / verifySpatialProof', () => {
  it('verifies a signed spatial proof end to end', () => {
    const claim = makeClaim();
    const unsigned = createUnsignedSpatialProof({
      claim,
      spatialObject: SITE_BOUNDARY,
      issuedAt: T0,
    });
    const signed = signSpatialProof(unsigned, SEED, 1) as SignedProof;
    expect(signed.signature).toBeDefined();
    const result = verifySpatialProof(signed);
    expect(result.valid).toBe(true);
    expect(result.relationId).toBe(claim.relationId);
    expect(result.spatialObjectId).toBe(SITE_BOUNDARY.spatialId);
  });

  it('rejects a tampered relation', () => {
    const claim = makeClaim();
    const unsigned = createUnsignedSpatialProof({
      claim,
      spatialObject: SITE_BOUNDARY,
      issuedAt: T0,
    });
    const signed = signSpatialProof(unsigned, SEED, 1) as SignedProof;
    const tampered: SignedProof = {
      ...signed,
      payload: {
        spatialRelation: { ...claim, result: { matched: !claim.result.matched } },
      },
    };
    const result = verifySpatialProof(tampered);
    expect(result.valid).toBe(false);
  });

  it('rejects a tampered spatial object id', () => {
    const claim = makeClaim();
    const unsigned = createUnsignedSpatialProof({
      claim,
      spatialObject: SITE_BOUNDARY,
      issuedAt: T0,
    });
    const signed = signSpatialProof(unsigned, SEED, 1) as SignedProof;
    const tampered: SignedProof = {
      ...signed,
      payload: {
        spatialRelation: { ...claim, spatialObjectId: 'totem:spatial:evil' },
      },
    };
    const result = verifySpatialProof(tampered);
    expect(result.valid).toBe(false);
  });
});

// ── 18. proofgraph helper outputs deterministic refs ───────────────────────

describe('proofgraph helpers', () => {
  it('produces deterministic node and edge refs', () => {
    const claim = makeClaim();
    const objNode = spatialObjectToProofGraphNode(SITE_BOUNDARY);
    const relationNode = spatialRelationToProofGraphNode(claim);
    const edges = spatialRelationToGraphEdges(claim);

    expect(objNode.id).toBe('custom:' + SITE_BOUNDARY.spatialId);
    expect(relationNode.id).toBe('custom:' + claim.relationId);
    expect(edges.some((e) => e.type === 'about' && e.to === 'device:drone-001')).toBe(true);
    expect(edges.some((e) => e.type === 'references' && e.to === SITE_BOUNDARY.spatialId)).toBe(true);
  });

  it('produces the same edge ids for identical claims', () => {
    const a = spatialRelationToGraphEdges(makeClaim());
    const b = spatialRelationToGraphEdges(makeClaim());
    expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id));
  });
});

describe('canonicalJson', () => {
  it('sorts keys deterministically', () => {
    const a = canonicalJson({ z: 1, a: { y: 2, b: 3 } });
    const b = canonicalJson({ a: { b: 3, y: 2 }, z: 1 });
    expect(a).toBe(b);
  });
});