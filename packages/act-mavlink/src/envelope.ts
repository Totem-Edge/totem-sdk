/**
 * RFC-025 §5.5 — mission envelope.
 *
 * The envelope is the unit of authority: `uploadMission` prepares and commits
 * it, `startMission` is authorized against its digest, and RFC-023 enforces its
 * speed/duration/altitude bounds from the prepared command. A start that
 * references a different plan than the one authorized fails closed.
 */

import { hashCanonical } from '@totemsdk/act-core';

export interface Waypoint {
  latitudeDeg: number;
  longitudeDeg: number;
  altitudeMetres: number;
}

export interface Geofence {
  latitudeDeg: number;
  longitudeDeg: number;
  radiusMetres: number;
}

export interface MissionEnvelope {
  envelopeId: string;
  /** ResourceId key of the target vehicle. */
  vehicle: string;
  waypoints: readonly Waypoint[];
  /** Altitude ceiling, in metres (decimal string). */
  maxAltitudeMetres: string;
  /** Ground-speed ceiling, in m/s (decimal string). */
  maxSpeedMetresPerSecond: string;
  /** Mission wall-clock ceiling, in seconds (decimal string). */
  maxDurationSeconds: string;
  geofence?: Geofence;
}

const EARTH_RADIUS_METRES = 6_371_000;

/** Great-circle distance between two WGS-84 points, in metres. */
export function distanceMetres(a: Waypoint, b: Waypoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitudeDeg - a.latitudeDeg);
  const dLon = toRad(b.longitudeDeg - a.longitudeDeg);
  const lat1 = toRad(a.latitudeDeg);
  const lat2 = toRad(b.latitudeDeg);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Canonical digest of the authorized plan. */
export function envelopeDigest(envelope: MissionEnvelope): string {
  return hashCanonical('TOTEM_ACT_MAVLINK_MISSION_ENVELOPE_V1', {
    envelopeId: envelope.envelopeId,
    vehicle: envelope.vehicle,
    waypoints: envelope.waypoints.map((waypoint) => ({
      latitudeDeg: waypoint.latitudeDeg,
      longitudeDeg: waypoint.longitudeDeg,
      altitudeMetres: waypoint.altitudeMetres,
    })),
    maxAltitudeMetres: envelope.maxAltitudeMetres,
    maxSpeedMetresPerSecond: envelope.maxSpeedMetresPerSecond,
    maxDurationSeconds: envelope.maxDurationSeconds,
    geofence: envelope.geofence
      ? {
          latitudeDeg: envelope.geofence.latitudeDeg,
          longitudeDeg: envelope.geofence.longitudeDeg,
          radiusMetres: envelope.geofence.radiusMetres,
        }
      : null,
  });
}

function positive(value: string): boolean {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

/** Structural and physical validation; returns human-readable issues. */
export function validateMissionEnvelope(envelope: MissionEnvelope): string[] {
  const issues: string[] = [];
  if (envelope.envelopeId.trim() === '') issues.push('envelopeId is required');
  if (envelope.vehicle.trim() === '') issues.push('vehicle is required');
  if (envelope.waypoints.length === 0) issues.push('at least one waypoint is required');
  if (envelope.waypoints.length > 100) issues.push('mission exceeds the 100-waypoint limit');
  if (!positive(envelope.maxAltitudeMetres)) issues.push('maxAltitudeMetres must be positive');
  if (!positive(envelope.maxSpeedMetresPerSecond)) issues.push('maxSpeedMetresPerSecond must be positive');
  if (!positive(envelope.maxDurationSeconds)) issues.push('maxDurationSeconds must be positive');

  const maxAltitude = Number(envelope.maxAltitudeMetres);
  for (const [index, waypoint] of envelope.waypoints.entries()) {
    if (!Number.isFinite(waypoint.latitudeDeg) || waypoint.latitudeDeg < -90 || waypoint.latitudeDeg > 90) {
      issues.push(`waypoint ${index} latitude is out of range`);
    }
    if (!Number.isFinite(waypoint.longitudeDeg) || waypoint.longitudeDeg < -180 || waypoint.longitudeDeg > 180) {
      issues.push(`waypoint ${index} longitude is out of range`);
    }
    if (!Number.isFinite(waypoint.altitudeMetres) || waypoint.altitudeMetres < 0) {
      issues.push(`waypoint ${index} altitude is invalid`);
    } else if (waypoint.altitudeMetres > maxAltitude) {
      issues.push(`waypoint ${index} altitude ${waypoint.altitudeMetres} m exceeds the envelope ceiling ${maxAltitude} m`);
    }
    if (envelope.geofence) {
      const distance = distanceMetres(
        { latitudeDeg: envelope.geofence.latitudeDeg, longitudeDeg: envelope.geofence.longitudeDeg, altitudeMetres: 0 },
        waypoint,
      );
      if (distance > envelope.geofence.radiusMetres) {
        issues.push(`waypoint ${index} is ${Math.round(distance)} m from the geofence centre (limit ${envelope.geofence.radiusMetres} m)`);
      }
    }
  }
  return issues;
}

export function assertValidMissionEnvelope(envelope: MissionEnvelope): void {
  const issues = validateMissionEnvelope(envelope);
  if (issues.length > 0) {
    throw new Error(`invalid mission envelope '${envelope.envelopeId}': ${issues.join('; ')}`);
  }
}
