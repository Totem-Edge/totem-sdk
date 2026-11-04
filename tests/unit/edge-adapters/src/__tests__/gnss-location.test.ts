/**
 * GNSS wire fix → signed location claim seam (edge-gnss → location-proof).
 */

import { sha3_256, toHex } from '@totemsdk/core';
import { scoreLocationClaim } from '@totemsdk/location-proof';
import type { GnssFix } from '@totemsdk/edge-gnss';
import { gnssFixToLocationClaim } from '../gnss-location.js';

const OBSERVED_AT = 1_700_000_000_000;
const RAW = new Uint8Array([0x24, 0x47, 0x50, 0x47, 0x47, 0x41]);

function fix(overrides: Partial<GnssFix> = {}): GnssFix {
  return {
    lat: 51.5,
    lon: -0.12,
    altitudeM: 30,
    speedMps: 4.2,
    headingDeg: 91,
    accuracyM: 3,
    hdop: 0.7,
    vdop: 1.1,
    pdop: 1.3,
    satellitesUsed: 14,
    fixType: 'rtk-fixed',
    source: 'gnss',
    observedAt: OBSERVED_AT,
    raw: RAW,
    nmea: ['$GPGGA,120000.00,5130.00,N,00007.20,W,4,14,0.7,30.0,M,,,,*00'],
    ...overrides,
  };
}

describe('gnssFixToLocationClaim', () => {
  it('maps position, source quality and receiver evidence into a claim', () => {
    const claim = gnssFixToLocationClaim(fix(), { subjectId: 'device:gnss-1', deviceClass: 'drone' });

    expect(claim.subjectId).toBe('device:gnss-1');
    expect(claim.deviceId).toBe('device:gnss-1');
    expect(claim.deviceClass).toBe('drone');
    expect(claim.observedAt).toBe(OBSERVED_AT);
    expect(claim.location).toEqual({ lat: 51.5, lon: -0.12, altitudeM: 30, accuracyM: 3 });
    expect(claim.source).toMatchObject({
      type: 'gnss',
      fixType: 'rtk-fixed',
      satellitesUsed: 14,
      hdop: 0.7,
      vdop: 1.1,
      pdop: 1.3,
    });
    expect(claim.source.rawPayloadHash).toBe(toHex(sha3_256(RAW)));
    expect(claim.source.nmeaPayloadHash).toBeTruthy();
    expect(claim.claimId).toMatch(/^totem:location:/);
  });

  it('is deterministic and scores as a strong fix', () => {
    const first = gnssFixToLocationClaim(fix(), { subjectId: 'device:gnss-1' });
    const second = gnssFixToLocationClaim(fix(), { subjectId: 'device:gnss-1' });
    expect(second.claimId).toBe(first.claimId);
    expect(scoreLocationClaim(first).score).toBeGreaterThan(0);
  });

  it('normalizes an unknown source label and omits absent optional fields', () => {
    const claim = gnssFixToLocationClaim(fix({ source: 'vendor-specific', raw: undefined, nmea: undefined, altitudeM: undefined }), {
      subjectId: 'device:gnss-2',
    });
    expect(claim.source.type).toBe('other');
    expect(claim.source.rawPayloadHash).toBeUndefined();
    expect(claim.source.nmeaPayloadHash).toBeUndefined();
    expect(claim.location.altitudeM).toBeUndefined();
  });
});
