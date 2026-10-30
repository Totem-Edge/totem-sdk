import { createLocationPortAdapter } from '../location';
import type { SignedProof } from '@totemsdk/proof';

function testSeed(n: number): Uint8Array {
  const s = new Uint8Array(32);
  s[0] = n & 0xff;
  s[1] = (n >> 8) & 0xff;
  return s;
}

const SEED = testSeed(7);
const T0 = 1_700_000_000_000;

describe('createLocationPortAdapter — createClaim', () => {
  it('creates a claim with a content-derived claimId', async () => {
    const port = createLocationPortAdapter();
    const result = await port.createClaim({
      subjectId: 'device:drone-001',
      deviceId: 'drone-001',
      deviceClass: 'drone',
      observedAt: T0,
      location: { lat: 51.5074, lon: -0.1278, altitudeM: 120, accuracyM: 3 },
      source: { type: 'gnss', satellitesUsed: 12, hdop: 1.1 },
    });
    expect(result.ok).toBe(true);
    expect(result.data?.claimId.startsWith('totem:location:')).toBe(true);
    const claim = result.data?.claim as { subjectId: string; deviceId: string };
    expect(claim.subjectId).toBe('device:drone-001');
    expect(claim.deviceId).toBe('drone-001');
  });

  it('returns ok:false on invalid coordinates', async () => {
    const port = createLocationPortAdapter();
    const result = await port.createClaim({
      subjectId: 'device:drone-001',
      deviceId: 'drone-001',
      location: { lat: 200, lon: -0.1278 },
      source: { type: 'gnss' },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('latitude');
  });
});

describe('createLocationPortAdapter — scoreClaim', () => {
  it('scores a corroborated claim deterministically', async () => {
    const port = createLocationPortAdapter();
    const created = await port.createClaim({
      subjectId: 'device:drone-001',
      deviceId: 'drone-001',
      deviceClass: 'drone',
      observedAt: T0,
      location: { lat: 51.5074, lon: -0.1278, accuracyM: 3 },
      source: { type: 'rtk', satellitesUsed: 12, hdop: 1.1, rawPayloadHash: 'abc' },
      corroboration: { beaconsSeen: ['beacon-1'] },
    });
    const result = await port.scoreClaim({ claim: created.data?.claim, options: { now: T0 } });
    expect(result.ok).toBe(true);
    expect(result.data?.score).toBeGreaterThanOrEqual(0);
    expect(result.data?.score).toBeLessThanOrEqual(100);
    expect(result.data?.level).toBe('high');
  });

  it('returns ok:false for a non-claim', async () => {
    const port = createLocationPortAdapter();
    const result = await port.scoreClaim({ claim: { nope: true } });
    expect(result.ok).toBe(false);
  });
});

describe('createLocationPortAdapter — createTrail', () => {
  it('creates a trail and detects impossible jumps', async () => {
    const port = createLocationPortAdapter();
    const result = await port.createTrail({
      subjectId: 'device:drone-001',
      deviceId: 'drone-001',
      samples: [
        { observedAt: T0, location: { lat: 51.5074, lon: -0.1278 } },
        { observedAt: T0 + 1_000, location: { lat: 51.5084, lon: -0.1278 } },
        // Impossible jump: ~3km west in 100ms
        { observedAt: T0 + 1_100, location: { lat: 51.5084, lon: -0.1500 } },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.data?.trailId.startsWith('totem:movement:')).toBe(true);
    const trail = result.data?.trail as { impossibleJumpDetected: boolean };
    expect(trail.impossibleJumpDetected).toBe(true);
  });

  it('returns ok:false on empty samples', async () => {
    const port = createLocationPortAdapter();
    const result = await port.createTrail({
      subjectId: 'x',
      deviceId: 'y',
      samples: [],
    });
    expect(result.ok).toBe(false);
  });
});

describe('createLocationPortAdapter — createProof / verifyProof', () => {
  async function makeClaim(port: ReturnType<typeof createLocationPortAdapter>) {
    const created = await port.createClaim({
      subjectId: 'device:drone-001',
      deviceId: 'drone-001',
      deviceClass: 'drone',
      observedAt: T0,
      location: { lat: 51.5074, lon: -0.1278, accuracyM: 3 },
      source: { type: 'gnss', satellitesUsed: 12 },
    });
    return created.data?.claim;
  }

  it('returns an unsigned proof when no seed is configured', async () => {
    const port = createLocationPortAdapter();
    const claim = await makeClaim(port);
    const result = await port.createProof({ claim });
    expect(result.ok).toBe(true);
    expect(typeof result.data?.proofId).toBe('string');
    const proof = result.data?.proof as { signature?: unknown };
    expect(proof.signature).toBeUndefined();
  });

  it('returns a signed proof and verifies it end to end', async () => {
    const port = createLocationPortAdapter({ seed: SEED, keyIndex: 1 });
    const claim = await makeClaim(port);
    const created = await port.createProof({ claim });
    expect(created.ok).toBe(true);

    const proof = created.data?.proof as SignedProof;
    expect(proof.signature).toBeDefined();

    const verified = await port.verifyProof({ proof, now: T0 });
    expect(verified.ok).toBe(true);
    expect(verified.data?.valid).toBe(true);
    expect(verified.data?.claimId).toBe((claim as { claimId: string }).claimId);
  });

  it('uses the configured issuer when no claim issuer is supplied', async () => {
    const port = createLocationPortAdapter({ seed: SEED, keyIndex: 1, issuer: 'MxISSUER' });
    const claim = await makeClaim(port);
    const created = await port.createProof({ claim });
    const proof = created.data?.proof as { issuer: string };
    expect(proof.issuer).toBe('MxISSUER');
  });

  it('verifies a tampered proof as invalid', async () => {
    const port = createLocationPortAdapter({ seed: SEED, keyIndex: 1 });
    const claim = await makeClaim(port);
    const created = await port.createProof({ claim });
    const tampered = {
      ...(created.data?.proof as SignedProof),
      payload: { locationClaim: { ...(claim as object), deviceId: 'evil' } },
    };
    const verified = await port.verifyProof({ proof: tampered, now: T0 });
    expect(verified.ok).toBe(true);
    expect(verified.data?.valid).toBe(false);
  });
});