import { parseNmeaFix, parseNmeaSentence } from '../nmea.js';

const GGA = '$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47';
const RMC = '$GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A';
const GSA = '$GPGSA,A,3,04,05,,09,12,,,24,,,,,2.5,1.3,2.1*39';

describe('NMEA 0183 parser', () => {
  it('parses GGA position, quality, satellites and altitude', () => {
    const sentence = parseNmeaSentence(GGA);
    expect(sentence).toEqual({
      type: 'GGA',
      time: '123519',
      lat: expect.closeTo(48.1173, 4),
      lon: expect.closeTo(11.5166667, 4),
      quality: 1,
      satellitesUsed: 8,
      hdop: 0.9,
      altitudeM: 545.4,
    });
  });

  it('parses RMC speed, heading and date', () => {
    const sentence = parseNmeaSentence(RMC);
    expect(sentence).toMatchObject({
      type: 'RMC',
      status: 'A',
      speedKnots: 22.4,
      headingDeg: 84.4,
      date: '230394',
    });
  });

  it('parses GSA fix type and DOP values', () => {
    expect(parseNmeaSentence(GSA)).toEqual({
      type: 'GSA',
      fixType: 3,
      pdop: 2.5,
      hdop: 1.3,
      vdop: 2.1,
    });
  });

  it('merges GGA, RMC and GSA into a 3D fix', () => {
    const fix = parseNmeaFix([GGA, RMC, GSA], { source: 'rtk', now: 1_700_000_000_000 });
    expect(fix).not.toBeNull();
    expect(fix!.lat).toBeCloseTo(48.1173, 4);
    expect(fix!.lon).toBeCloseTo(11.5166667, 4);
    expect(fix!.altitudeM).toBe(545.4);
    expect(fix!.speedMps).toBeCloseTo(11.5235, 3);
    expect(fix!.headingDeg).toBe(84.4);
    expect(fix!.satellitesUsed).toBe(8);
    expect(fix!.hdop).toBe(0.9);
    expect(fix!.pdop).toBe(2.5);
    expect(fix!.vdop).toBe(2.1);
    expect(fix!.fixType).toBe('3d');
    expect(fix!.source).toBe('rtk');
    expect(fix!.observedAt).toBe(Date.UTC(1994, 2, 23, 12, 35, 19));
    expect(fix!.nmea).toEqual([GGA, RMC, GSA]);
  });

  it('rejects invalid checksums, malformed and unsupported sentences', () => {
    expect(parseNmeaSentence('$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*00')).toBeNull();
    expect(parseNmeaSentence('not-nmea')).toBeNull();
    expect(parseNmeaSentence('$GPXYZ,1,2,3*00')).toBeNull();
    expect(parseNmeaFix([], {})).toBeNull();
    expect(parseNmeaFix(['$GPGGA,broken*00'])).toBeNull();
  });

  it('returns no fix for quality zero or a void RMC', () => {
    const noFixGga = withChecksum('GPGGA,123519,4807.038,N,01131.000,E,0,00,,,M,,M,,');
    expect(parseNmeaFix([noFixGga])).toBeNull();
    const voidRmc = withChecksum('GPRMC,123519,V,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W');
    expect(parseNmeaFix([voidRmc])).toBeNull();
  });

  it('handles southern/western hemispheres', () => {
    const body = 'GPGGA,123519,3352.000,S,15112.000,E,1,06,1.2,10.0,M,0.0,M,,';
    const fix = parseNmeaFix([withChecksum(body)]);
    expect(fix!.lat).toBeLessThan(0);
    expect(fix!.lon).toBeGreaterThan(0);
  });
});

function withChecksum(body: string): string {
  let checksum = 0;
  for (const character of body) checksum ^= character.charCodeAt(0);
  return `$${body}*${checksum.toString(16).toUpperCase().padStart(2, '0')}`;
}
