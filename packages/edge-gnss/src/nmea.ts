/**
 * Minimal NMEA 0183 parser for GNSS receivers.
 *
 * Supports GGA (position/altitude/quality), RMC (speed/heading/date) and GSA
 * (fix type/DOP) from any talker ID (GP, GN, GL, GA, BD, …). Checksums are
 * mandatory; malformed or unsupported sentences are rejected.
 */

import type { GnssFix, GnssFixType } from './transport.js';

export interface NmeaGga {
  type: 'GGA';
  time?: string;
  lat?: number;
  lon?: number;
  quality: number;
  satellitesUsed?: number;
  hdop?: number;
  altitudeM?: number;
}

export interface NmeaRmc {
  type: 'RMC';
  time?: string;
  date?: string;
  status: 'A' | 'V';
  lat?: number;
  lon?: number;
  speedKnots?: number;
  headingDeg?: number;
}

export interface NmeaGsa {
  type: 'GSA';
  fixType: 1 | 2 | 3;
  pdop?: number;
  hdop?: number;
  vdop?: number;
}

export type NmeaSentence = NmeaGga | NmeaRmc | NmeaGsa;

export interface NmeaFixOptions {
  /** Fallback timestamp when the sentences carry no date/time. Default Date.now(). */
  now?: number;
  /** Source label carried into the fix. Default "gnss". */
  source?: string;
  /** Raw receiver payload for the fix. */
  raw?: Uint8Array;
}

export function parseNmeaSentence(line: string): NmeaSentence | null {
  const trimmed = line.trim();
  const match = /^\$([^*]+)\*([0-9A-Fa-f]{2})$/.exec(trimmed);
  if (!match) return null;
  let checksum = 0;
  for (const character of match[1]) checksum ^= character.charCodeAt(0);
  if (checksum !== Number.parseInt(match[2], 16)) return null;

  const fields = match[1].split(',');
  if (fields[0].length < 5) return null;
  const kind = fields[0].slice(2);

  if (kind === 'GGA') {
    const quality = number(fields[6]);
    if (quality === undefined) return null;
    return {
      type: 'GGA',
      time: fields[1] || undefined,
      lat: coordinate(fields[2], fields[3]),
      lon: coordinate(fields[4], fields[5]),
      quality,
      satellitesUsed: number(fields[7]),
      hdop: number(fields[8]),
      altitudeM: number(fields[9]),
    };
  }

  if (kind === 'RMC') {
    const status = fields[2];
    if (status !== 'A' && status !== 'V') return null;
    return {
      type: 'RMC',
      time: fields[1] || undefined,
      status,
      lat: coordinate(fields[3], fields[4]),
      lon: coordinate(fields[5], fields[6]),
      speedKnots: number(fields[7]),
      headingDeg: number(fields[8]),
      date: fields[9] || undefined,
    };
  }

  if (kind === 'GSA') {
    const fixType = number(fields[2]);
    if (fixType !== 1 && fixType !== 2 && fixType !== 3) return null;
    return {
      type: 'GSA',
      fixType,
      pdop: number(fields[15]),
      hdop: number(fields[16]),
      vdop: number(fields[17]),
    };
  }

  return null;
}

/**
 * Merge GGA/RMC/GSA sentences into one fix. Returns null when no position is
 * present or the receiver reports no fix.
 */
export function parseNmeaFix(lines: string[], options: NmeaFixOptions = {}): GnssFix | null {
  const sentences = lines
    .map((line) => parseNmeaSentence(line))
    .filter((sentence): sentence is NmeaSentence => sentence !== null);
  if (sentences.length === 0) return null;

  const gga = sentences.find((sentence): sentence is NmeaGga => sentence.type === 'GGA');
  const rmc = sentences.find((sentence): sentence is NmeaRmc => sentence.type === 'RMC');
  const gsa = sentences.find((sentence): sentence is NmeaGsa => sentence.type === 'GSA');

  const lat = gga?.lat ?? rmc?.lat;
  const lon = gga?.lon ?? rmc?.lon;
  if (lat === undefined || lon === undefined) return null;
  if (!validCoordinate(lat, lon)) return null;

  if (gga?.quality === 0 || rmc?.status === 'V') return null;

  const fixType = resolveFixType(gga?.quality, gsa?.fixType);
  const observedAt = nmeaTimestamp(rmc?.date, rmc?.time ?? gga?.time, options.now ?? Date.now());

  return {
    lat,
    lon,
    fixType,
    source: options.source ?? 'gnss',
    observedAt,
    ...(gga?.altitudeM !== undefined ? { altitudeM: gga.altitudeM } : {}),
    ...(rmc?.speedKnots !== undefined ? { speedMps: rmc.speedKnots * 0.514444 } : {}),
    ...(rmc?.headingDeg !== undefined ? { headingDeg: rmc.headingDeg } : {}),
    ...(gga?.satellitesUsed !== undefined ? { satellitesUsed: gga.satellitesUsed } : {}),
    ...(gga?.hdop !== undefined ? { hdop: gga.hdop } : gsa?.hdop !== undefined ? { hdop: gsa.hdop } : {}),
    ...(gsa?.vdop !== undefined ? { vdop: gsa.vdop } : {}),
    ...(gsa?.pdop !== undefined ? { pdop: gsa.pdop } : {}),
    ...(options.raw ? { raw: options.raw } : {}),
    nmea: lines.slice(),
  };
}

function resolveFixType(quality: number | undefined, gsaFix: 1 | 2 | 3 | undefined): GnssFixType {
  if (quality === 3) return '3d';
  if (quality === 4) return 'rtk-fixed';
  if (quality === 5) return 'rtk-float';
  if (quality === 2) return 'dgps';
  if (quality === 6) return 'estimated';
  if (gsaFix === 3) return '3d';
  if (gsaFix === 2) return '2d';
  if (quality !== undefined && quality > 0) return '3d';
  return 'none';
}

function coordinate(value: string | undefined, hemisphere: string | undefined): number | undefined {
  if (!value || !hemisphere) return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  const degrees = Math.floor(numeric / 100);
  const minutes = numeric - degrees * 100;
  const result = degrees + minutes / 60;
  if (!Number.isFinite(result)) return undefined;
  if (hemisphere === 'S' || hemisphere === 'W') return -result;
  if (hemisphere !== 'N' && hemisphere !== 'E') return undefined;
  return result;
}

function number(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function validCoordinate(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function nmeaTimestamp(date: string | undefined, time: string | undefined, fallback: number): number {
  if (!date || !time || date.length !== 6 || time.length < 6) return fallback;
  const day = Number(date.slice(0, 2));
  const month = Number(date.slice(2, 4)) - 1;
  const twoDigitYear = Number(date.slice(4, 6));
  const year = twoDigitYear >= 80 ? 1900 + twoDigitYear : 2000 + twoDigitYear;
  const hours = Number(time.slice(0, 2));
  const minutes = Number(time.slice(2, 4));
  const seconds = Number(time.slice(4, 6));
  const timestamp = Date.UTC(year, month, day, hours, minutes, seconds);
  return Number.isFinite(timestamp) ? timestamp : fallback;
}
