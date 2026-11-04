/**
 * GNSS → location-claim seam (RFC-074 / proof family).
 *
 * The wire connector (`@totemsdk/edge-gnss`) produces NMEA-derived fixes; the
 * proof layer (`@totemsdk/location-proof`) produces signed, scorable location
 * claims. This adapter is the bridge: it preserves the receiver's evidence
 * (raw payload and NMEA hashes) instead of inventing a position.
 */

import { sha3_256, toHex } from '@totemsdk/core';
import {
  createLocationClaim,
  type LocationClaim,
  type LocationSourceType,
} from '@totemsdk/location-proof';
import type { GnssFix } from '@totemsdk/edge-gnss';

export interface GnssLocationClaimOptions {
  /** Device/subject identifier the claim is about. */
  subjectId: string;
  /** Defaults to subjectId. */
  deviceId?: string;
  deviceClass?: LocationClaim['deviceClass'];
  operatorId?: string;
  challenge?: LocationClaim['challenge'];
  metadata?: Record<string, unknown>;
}

const SOURCE_TYPES = new Set<LocationSourceType>([
  'gnss',
  'gps',
  'rtk',
  'cell',
  'wifi',
  'ble',
  'lorawan',
  'gateway',
  'network',
  'manual',
  'derived',
  'other',
]);

/**
 * Convert one receiver fix into a deterministic location claim.
 *
 * Byte-level evidence is preserved as hashes (never the raw payload) so a
 * verifier can bind the claim back to the receiver output. The claim is
 * unsigned until `signLocationProof` is called.
 */
export function gnssFixToLocationClaim(
  fix: GnssFix,
  options: GnssLocationClaimOptions,
): LocationClaim {
  const rawPayloadHash = fix.raw ? toHex(sha3_256(fix.raw)) : undefined;
  const nmeaPayloadHash =
    fix.nmea && fix.nmea.length > 0
      ? toHex(sha3_256(new TextEncoder().encode(fix.nmea.join('\n'))))
      : undefined;

  const metadata = { ...(fix.metadata ?? {}), ...(options.metadata ?? {}) };

  return createLocationClaim({
    subjectId: options.subjectId,
    deviceId: options.deviceId ?? options.subjectId,
    ...(options.deviceClass !== undefined ? { deviceClass: options.deviceClass } : {}),
    ...(options.operatorId !== undefined ? { operatorId: options.operatorId } : {}),
    observedAt: fix.observedAt,
    location: {
      lat: fix.lat,
      lon: fix.lon,
      ...(fix.altitudeM !== undefined ? { altitudeM: fix.altitudeM } : {}),
      ...(fix.accuracyM !== undefined ? { accuracyM: fix.accuracyM } : {}),
    },
    source: {
      type: SOURCE_TYPES.has(fix.source as LocationSourceType)
        ? (fix.source as LocationSourceType)
        : 'other',
      fixType: fix.fixType,
      ...(fix.satellitesUsed !== undefined ? { satellitesUsed: fix.satellitesUsed } : {}),
      ...(fix.hdop !== undefined ? { hdop: fix.hdop } : {}),
      ...(fix.vdop !== undefined ? { vdop: fix.vdop } : {}),
      ...(fix.pdop !== undefined ? { pdop: fix.pdop } : {}),
      ...(rawPayloadHash !== undefined ? { rawPayloadHash } : {}),
      ...(nmeaPayloadHash !== undefined ? { nmeaPayloadHash } : {}),
    },
    ...(options.challenge !== undefined ? { challenge: options.challenge } : {}),
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  });
}
