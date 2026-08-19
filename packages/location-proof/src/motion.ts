/**
 * Motion primitives — Haversine distance, speed, impossible-jump detection,
 * and movement trail construction.
 *
 * All functions are pure and deterministic. Time is expressed in
 * milliseconds since the Unix epoch (matching the rest of the Totem SDK);
 * speed is derived as meters/second.
 */

import type { GeoPoint, MotionSample, MovementTrail } from './types.js';
import type { CreateMovementTrailParams, ImpossibleJumpResult, MotionOptions } from './types.js';
import { computeMovementTrailId } from './canonical.js';

const EARTH_RADIUS_M = 6_371_000;
const DEFAULT_MAX_SPEED_MPS = 100;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance between two points using the Haversine formula.
 */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Average speed between two samples in m/s.
 * Returns 0 when the timestamps do not advance (avoiding division by zero).
 */
export function computeSpeedMps(a: MotionSample, b: MotionSample): number {
  const deltaSeconds = (b.observedAt - a.observedAt) / 1000;
  if (!(deltaSeconds > 0)) return 0;
  return distanceMeters(a.location, b.location) / deltaSeconds;
}

/**
 * Scan consecutive samples for segments faster than the threshold.
 * maxSpeedMps always reports the maximum observed consecutive-pair speed
 * regardless of the threshold.
 */
export function detectImpossibleJumps(
  samples: MotionSample[],
  options: MotionOptions = {},
): ImpossibleJumpResult {
  const threshold = options.maxSpeedMps ?? DEFAULT_MAX_SPEED_MPS;
  const jumps: ImpossibleJumpResult['jumps'] = [];
  let maxSpeedMps = 0;

  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    const deltaSeconds = (b.observedAt - a.observedAt) / 1000;
    const speedMps = computeSpeedMps(a, b);
    if (speedMps > maxSpeedMps) maxSpeedMps = speedMps;
    if (speedMps > threshold) {
      jumps.push({
        fromIndex: i - 1,
        toIndex: i,
        speedMps,
        distanceM: distanceMeters(a.location, b.location),
        deltaSeconds,
      });
    }
  }

  return { impossible: jumps.length > 0, maxSpeedMps, jumps };
}

/**
 * Build a MovementTrail from a set of samples.
 *
 * Samples are sorted by observedAt, and startedAt/endedAt are derived from
 * the sorted range. maxComputedSpeedMps and impossibleJumpDetected are
 * computed from the samples. The trailId is content-derived (see
 * computeMovementTrailId) unless explicitly provided.
 */
export function createMovementTrail(params: CreateMovementTrailParams): MovementTrail {
  if (params.samples.length === 0) {
    throw new Error('movement trail requires at least one sample');
  }

  const samples = [...params.samples].sort((a, b) => a.observedAt - b.observedAt);
  const startedAt = samples[0].observedAt;
  const endedAt = samples[samples.length - 1].observedAt;
  const { impossible, maxSpeedMps } = detectImpossibleJumps(samples, {
    maxSpeedMps: params.maxSpeedMps,
  });

  const base: Omit<MovementTrail, 'trailId'> = {
    subjectId: params.subjectId,
    deviceId: params.deviceId,
    samples,
    startedAt,
    endedAt,
    maxComputedSpeedMps: maxSpeedMps,
    impossibleJumpDetected: impossible,
    ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
  };

  return {
    ...base,
    trailId: params.trailId ?? computeMovementTrailId(base),
  };
}
