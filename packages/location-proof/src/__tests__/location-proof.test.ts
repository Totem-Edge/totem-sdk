/**
 * @totemsdk/location-proof — test suite
 *
 * All tests use deterministic seeds and fixed timestamps. No test depends
 * on Date.now() unless time is explicitly injected.
 */

import {
  canonicalJson,
  computeLocationClaimId,
  hashLocationClaim,
  computeMovementTrailId,
  hashMovementTrail,
  validateGeoPoint,
  validateLocationClaim,
  validateMovementTrail,
  scoreLocationClaim,
  distanceMeters,
  detectImpossibleJumps,
  createMovementTrail,
  createLocationClaim,
  createUnsignedLocationProof,
  signLocationProof,
  verifyLocationProof,
  locationClaimToEvidenceRef,
  movementTrailToEvidenceRef,
  locationClaimToProofGraphNode,
  locationProofToGraphEdges,
} from '../index';
import { computeProofId } from '@totemsdk/proof';
import type {
  LocationClaim,
  LocationChallenge,
  LocationSource,
  MovementTrail,
} from '../index';

function testSeed(n: number): Uint8Array {
  const s = new Uint8Array(32);
  s[0] = n & 0xff;
  s[1] = (n >> 8) & 0xff;
  return s;
}

const SEED = testSeed(7);
const T0 = 1_700_000_000_000; // fixed epoch timestamp (ms)

function makeSource(partial: Partial<LocationSource> = {}): LocationSource {
  return {
    type: 'gnss',
    satellitesUsed: 12,
    hdop: 1.1,
    rawPayloadHash: 'abc123',
    ...partial,
  };
}

function makeChallenge(partial: Partial<LocationChallenge> = {}): LocationChallenge {
  return {
    nonce: 'challenge-nonce-1',
    issuedAt: T0,
    expiresAt: T0 + 60_000,
    verifierId: 'verifier-1',
    ...partial,
  };
}

function makeClaim(partial: Partial<LocationClaim> = {}): LocationClaim {
  return createLocationClaim({
    subjectId: 'device:drone-001',
    deviceId: 'drone-001',
    deviceClass: 'drone',
    operatorId: 'operator-1',
    observedAt: T0,
    location: { lat: 51.5074, lon: -0.1278, altitudeM: 120, accuracyM: 3 },
    source: makeSource(),
    challenge: makeChallenge(),
    corroboration: { beaconsSeen: ['beacon-1'] },
    ...partial,
  });
}

// ─── 1. canonical JSON ───────────────────────────────────────────────────────

describe('canonicalJson', () => {
  it('sorts keys deterministically regardless of insertion order', () => {
    const a = canonicalJson({ z: 1, a: { y: 2, b: 3 }, m: [3, 1] });
    const b = canonicalJson({ m: [3, 1], a: { b: 3, y: 2 }, z: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":{"b":3,"y":2},"m":[3,1],"z":1}');
  });
});

// ─── 2. Location claim IDs ───────────────────────────────────────────────────

describe('computeLocationClaimId', () => {
  it('is deterministic for identical input', () => {
    const claim = makeClaim();
    const a = computeLocationClaimId(claim);
    const b = computeLocationClaimId(claim);
    expect(a).toBe(b);
    expect(a.startsWith('totem:location:')).toBe(true);
    expect(a).toBe(claim.claimId);
  });

  it('ignores mutable fields (receivedAt, confidenceScore, metadata)', () => {
    const base = makeClaim();
    const withVolatile = computeLocationClaimId({
      ...base,
      receivedAt: T0 + 5000,
      confidenceScore: 42,
      metadata: { note: 'anything' },
    });
    expect(withVolatile).toBe(base.claimId);
  });

  it('changes when a meaningful field changes', () => {
    const base = makeClaim();
    const moved = createLocationClaim({
      ...base,
      location: { lat: 52.0, lon: 0.1 },
    });
    expect(moved.claimId).not.toBe(base.claimId);
  });
});

// ─── 3. Location claim hashing ───────────────────────────────────────────────

describe('hashLocationClaim', () => {
  it('is lowercase hex without 0x prefix', () => {
    const claim = makeClaim();
    const hash = hashLocationClaim(claim);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when meaningful fields change', () => {
    const base = makeClaim();
    const modified = { ...base, location: { lat: 10, lon: 20 } };
    expect(hashLocationClaim(modified)).not.toBe(hashLocationClaim(base));
  });

  it('does not change when volatile fields change', () => {
    const base = makeClaim();
    const modified = { ...base, confidenceScore: 99, receivedAt: T0 + 123 };
    expect(hashLocationClaim(modified)).toBe(hashLocationClaim(base));
  });
});

// ─── 4/5/6. Validation ───────────────────────────────────────────────────────

describe('validateGeoPoint', () => {
  it('rejects invalid latitude', () => {
    expect(validateGeoPoint({ lat: 91, lon: 0 }).errors).toContain(
      'latitude must be between -90 and 90',
    );
    expect(validateGeoPoint({ lat: -91, lon: 0 }).valid).toBe(false);
    expect(validateGeoPoint({ lat: NaN, lon: 0 }).valid).toBe(false);
  });

  it('rejects invalid longitude', () => {
    expect(validateGeoPoint({ lat: 0, lon: 181 }).errors).toContain(
      'longitude must be between -180 and 180',
    );
    expect(validateGeoPoint({ lat: 0, lon: -181 }).valid).toBe(false);
  });

  it('rejects negative accuracy', () => {
    const r = validateGeoPoint({ lat: 0, lon: 0, accuracyM: -1 });
    expect(r.errors).toContain('accuracy must be non-negative');
    expect(r.valid).toBe(false);
  });

  it('accepts negative altitude but rejects non-finite altitude', () => {
    expect(validateGeoPoint({ lat: 0, lon: 0, altitudeM: -400 }).valid).toBe(true);
    expect(validateGeoPoint({ lat: 0, lon: 0, altitudeM: Infinity }).valid).toBe(false);
  });
});

describe('validateLocationClaim', () => {
  it('accepts a well-formed claim', () => {
    const r = validateLocationClaim(makeClaim());
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('requires subjectId and deviceId', () => {
    expect(validateLocationClaim(makeClaim({ subjectId: '' })).valid).toBe(false);
    expect(validateLocationClaim(makeClaim({ deviceId: '' })).valid).toBe(false);
  });

  it('rejects an empty challenge nonce', () => {
    const r = validateLocationClaim(makeClaim({ challenge: makeChallenge({ nonce: '' }) }));
    expect(r.errors).toContain('challenge nonce cannot be empty');
  });

  it('rejects challenge expiresAt before issuedAt', () => {
    const r = validateLocationClaim(
      makeClaim({ challenge: makeChallenge({ issuedAt: T0 + 1000, expiresAt: T0 }) }),
    );
    expect(r.errors).toContain('challenge expiresAt cannot be before issuedAt');
  });

  it('rejects non-positive observedAt', () => {
    expect(validateLocationClaim(makeClaim({ observedAt: 0 })).valid).toBe(false);
  });
});

describe('validateMovementTrail', () => {
  it('rejects empty trails', () => {
    const trail = {
      trailId: 'totem:movement:x',
      subjectId: 's',
      deviceId: 'd',
      samples: [],
      startedAt: T0,
      endedAt: T0,
    } as MovementTrail;
    expect(validateMovementTrail(trail).valid).toBe(false);
  });

  it('rejects samples out of order', () => {
    const trail: MovementTrail = {
      trailId: 'totem:movement:x',
      subjectId: 's',
      deviceId: 'd',
      samples: [
        { observedAt: T0 + 2000, location: { lat: 0, lon: 0 } },
        { observedAt: T0, location: { lat: 0, lon: 0 } },
      ],
      startedAt: T0,
      endedAt: T0 + 2000,
    };
    expect(validateMovementTrail(trail).errors).toContain(
      'movement trail samples must be ordered by observedAt',
    );
  });
});

// ─── 7. Expired challenge ────────────────────────────────────────────────────

describe('scoreLocationClaim — challenge', () => {
  it('lowers confidence when the challenge is expired', () => {
    const fresh = makeClaim();
    const expired = makeClaim({
      challenge: makeChallenge({ expiresAt: T0 - 1 }),
    });
    const rFresh = scoreLocationClaim(fresh, { now: T0 });
    const rExpired = scoreLocationClaim(expired, { now: T0 });
    expect(rExpired.score).toBeLessThan(rFresh.score);
    expect(rExpired.negativeSignals).toContain('expired challenge');
  });
});

// ─── 8/9/10. Confidence scoring ──────────────────────────────────────────────

describe('scoreLocationClaim', () => {
  it('lowers confidence when the spoofing flag is set', () => {
    const clean = makeClaim();
    const spoofed = makeClaim({ source: makeSource({ spoofingFlag: true }) });
    const rClean = scoreLocationClaim(clean, { now: T0 });
    const rSpoofed = scoreLocationClaim(spoofed, { now: T0 });
    expect(rSpoofed.score).toBeLessThan(rClean.score);
    expect(rSpoofed.negativeSignals).toContain('spoofing flag set');
  });

  it('yields high confidence for RTK + low accuracy + nonce + beacon', () => {
    const claim = makeClaim({
      location: { lat: 51.5074, lon: -0.1278, accuracyM: 1 },
      source: makeSource({ type: 'rtk', satellitesUsed: 14, hdop: 0.8 }),
      challenge: makeChallenge(),
      corroboration: { beaconsSeen: ['beacon-1'], lorawanGateways: ['gw-1'] },
    });
    const r = scoreLocationClaim(claim, { now: T0 });
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.level).toBe('high');
  });

  it('yields lower confidence for manual source only', () => {
    const manual = makeClaim({
      source: makeSource({ type: 'manual', satellitesUsed: undefined, hdop: undefined, rawPayloadHash: undefined }),
      challenge: undefined,
      corroboration: undefined,
      location: { lat: 51.5, lon: -0.1 },
    });
    const rManual = scoreLocationClaim(manual, { now: T0 });
    const rGnss = scoreLocationClaim(makeClaim(), { now: T0 });
    expect(rManual.score).toBeLessThan(rGnss.score);
    expect(rManual.negativeSignals).toContain('manual source only');
  });

  it('is deterministic for the same input', () => {
    const claim = makeClaim();
    expect(scoreLocationClaim(claim, { now: T0 })).toEqual(
      scoreLocationClaim(claim, { now: T0 }),
    );
  });
});

// ─── 11. Haversine distance ──────────────────────────────────────────────────

describe('distanceMeters', () => {
  it('computes zero for identical points', () => {
    expect(distanceMeters({ lat: 10, lon: 20 }, { lat: 10, lon: 20 })).toBe(0);
  });

  it('sanity: ~111km per degree of latitude', () => {
    const d = distanceMeters({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it('is symmetric', () => {
    const a = { lat: 40.71, lon: -74.0 };
    const b = { lat: 34.05, lon: -118.24 };
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 6);
  });
});

// ─── 12. Impossible jump detection ───────────────────────────────────────────

describe('detectImpossibleJumps', () => {
  it('flags a segment faster than the default 100 m/s threshold', () => {
    const samples = [
      { observedAt: T0, location: { lat: 51.5, lon: -0.1 } },
      { observedAt: T0 + 1000, location: { lat: 51.6, lon: -0.1 } },
    ];
    const r = detectImpossibleJumps(samples);
    expect(r.impossible).toBe(true);
    expect(r.jumps.length).toBe(1);
    expect(r.jumps[0].speedMps).toBeGreaterThan(100);
    expect(r.jumps[0].fromIndex).toBe(0);
    expect(r.jumps[0].toIndex).toBe(1);
  });

  it('does not flag normal motion', () => {
    const samples = [
      { observedAt: T0, location: { lat: 51.5, lon: -0.1 } },
      { observedAt: T0 + 1000, location: { lat: 51.5001, lon: -0.1 } },
    ];
    expect(detectImpossibleJumps(samples).impossible).toBe(false);
  });

  it('respects a custom threshold override', () => {
    const samples = [
      { observedAt: T0, location: { lat: 51.5, lon: -0.1 } },
      { observedAt: T0 + 1000, location: { lat: 51.5005, lon: -0.1 } },
    ];
    expect(detectImpossibleJumps(samples, { maxSpeedMps: 1 }).impossible).toBe(true);
  });
});

// ─── 13. Movement trail IDs ──────────────────────────────────────────────────

describe('computeMovementTrailId / createMovementTrail', () => {
  it('is deterministic for identical input', () => {
    const samples = [
      { observedAt: T0, location: { lat: 51.5, lon: -0.1 } },
      { observedAt: T0 + 1000, location: { lat: 51.5001, lon: -0.1 } },
    ];
    const trail = createMovementTrail({ subjectId: 's', deviceId: 'd', samples });
    expect(trail.trailId.startsWith('totem:movement:')).toBe(true);
    expect(computeMovementTrailId(trail)).toBe(trail.trailId);
    expect(hashMovementTrail(trail)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('sorts samples and derives startedAt/endedAt', () => {
    const trail = createMovementTrail({
      subjectId: 's',
      deviceId: 'd',
      samples: [
        { observedAt: T0 + 2000, location: { lat: 0, lon: 0 } },
        { observedAt: T0, location: { lat: 0, lon: 0 } },
        { observedAt: T0 + 1000, location: { lat: 0, lon: 0 } },
      ],
    });
    expect(trail.startedAt).toBe(T0);
    expect(trail.endedAt).toBe(T0 + 2000);
    expect(trail.samples.map((s) => s.observedAt)).toEqual([T0, T0 + 1000, T0 + 2000]);
    expect(validateMovementTrail(trail).valid).toBe(true);
  });
});

// ─── 14. Unsigned proof creation ─────────────────────────────────────────────

describe('createUnsignedLocationProof', () => {
  it('produces a valid attestation UnsignedProof', () => {
    const claim = makeClaim();
    const proof = createUnsignedLocationProof({ claim, issuedAt: T0 });
    expect(proof.kind).toBe('attestation');
    expect(proof.subject.id).toBe(claim.subjectId);
    expect(proof.subject.kind).toBe('location');
    expect(proof.proofId.startsWith('totem:proof:')).toBe(true);
    expect(proof.payload?.['locationClaim']).toEqual(claim);
    expect(proof.evidence?.[0]).toEqual(locationClaimToEvidenceRef(claim));
  });

  it('is deterministic for the same claim and issuedAt', () => {
    const claim = makeClaim();
    const a = createUnsignedLocationProof({ claim, issuedAt: T0 });
    const b = createUnsignedLocationProof({ claim, issuedAt: T0 });
    expect(a).toEqual(b);
  });
});

// ─── 15. Sign + verify roundtrip ─────────────────────────────────────────────

describe('signLocationProof / verifyLocationProof', () => {
  it('roundtrips a signed location proof', () => {
    const claim = makeClaim();
    const unsigned = createUnsignedLocationProof({ claim, issuedAt: T0 });
    const signed = signLocationProof(unsigned, SEED, 1);
    const result = verifyLocationProof(signed, { now: T0 });
    expect(result.valid).toBe(true);
    expect(result.claimId).toBe(claim.claimId);
    expect(result.evidenceHashValid).toBe(true);
    expect(result.signerAddress).toBeTruthy();
  });

  it('fails verification when the payload is tampered after signing', () => {
    const claim = makeClaim();
    const signed = signLocationProof(
      createUnsignedLocationProof({ claim, issuedAt: T0 }),
      SEED,
      2,
    );
    const tampered = JSON.parse(JSON.stringify(signed)) as typeof signed;
    tampered.payload = { locationClaim: { ...claim, location: { lat: 88, lon: 88 } } };
    const result = verifyLocationProof(tampered, { now: T0 });
    expect(result.valid).toBe(false);
    expect(result.reason).toBeTruthy();
  });
});

// ─── 16. Evidence hash mismatch ──────────────────────────────────────────────

describe('verifyLocationProof — evidence integrity', () => {
  it('fails when the evidence hash does not match the payload claim', () => {
    const claim = makeClaim();
    const unsigned = createUnsignedLocationProof({ claim, issuedAt: T0 });
    const modified = {
      ...unsigned,
      evidence: [
        { id: claim.claimId, kind: 'location-claim', hash: 'f'.repeat(64) },
      ],
    };
    const { proofId: _proofId, ...coreFields } = modified;
    modified.proofId = computeProofId(coreFields);
    const signed = signLocationProof(modified, SEED, 3);
    const result = verifyLocationProof(signed, { now: T0 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('evidence hash');
  });

  it('fails when the claimId does not match its recomputation', () => {
    const claim = makeClaim();
    const badClaim = { ...claim, claimId: 'totem:location:' + 'ab'.repeat(32) };
    const signed = signLocationProof(
      createUnsignedLocationProof({ claim: badClaim, issuedAt: T0 }),
      SEED,
      4,
    );
    const result = verifyLocationProof(signed, { now: T0 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('claimId');
  });

  it('fails when the challenge has expired', () => {
    const claim = makeClaim({
      challenge: makeChallenge({ issuedAt: T0 - 5000, expiresAt: T0 - 1000 }),
    });
    const signed = signLocationProof(
      createUnsignedLocationProof({ claim, issuedAt: T0 }),
      SEED,
      5,
    );
    const result = verifyLocationProof(signed, { now: T0 });
    expect(result.valid).toBe(false);
    expect(result.expired).toBe(true);
  });
});

// ─── 17. Evidence refs ───────────────────────────────────────────────────────

describe('evidence refs', () => {
  it('produces a location-claim EvidenceRef', () => {
    const claim = makeClaim();
    expect(locationClaimToEvidenceRef(claim)).toEqual({
      id: claim.claimId,
      kind: 'location-claim',
      hash: hashLocationClaim(claim),
    });
  });

  it('produces a movement-trail EvidenceRef', () => {
    const trail = createMovementTrail({
      subjectId: 's',
      deviceId: 'd',
      samples: [{ observedAt: T0, location: { lat: 0, lon: 0 } }],
    });
    expect(movementTrailToEvidenceRef(trail)).toEqual({
      id: trail.trailId,
      kind: 'movement-trail',
      hash: hashMovementTrail(trail),
    });
  });
});

// ─── 18. Proofgraph helpers ──────────────────────────────────────────────────

describe('proofgraph helpers', () => {
  it('produces deterministic claim node IDs', () => {
    const claim = makeClaim();
    const a = locationClaimToProofGraphNode(claim);
    const b = locationClaimToProofGraphNode(claim);
    expect(a.id).toBe(b.id);
    expect(a.id).toBe('custom:' + claim.claimId);
    expect(a.type).toBe('custom');
  });

  it('produces deterministic edges for a signed proof', () => {
    const claim = makeClaim();
    const signed = signLocationProof(
      createUnsignedLocationProof({ claim, issuedAt: T0 }),
      SEED,
      6,
    );
    const edges = locationProofToGraphEdges(signed);
    const again = locationProofToGraphEdges(signed);
    expect(edges.map((e) => e.id)).toEqual(again.map((e) => e.id));
    expect(edges.length).toBeGreaterThanOrEqual(3); // about + references + supports
    expect(edges.some((e) => e.type === 'about')).toBe(true);
    expect(edges.some((e) => e.type === 'references')).toBe(true);
    expect(edges.some((e) => e.type === 'supports')).toBe(true);
  });
});
