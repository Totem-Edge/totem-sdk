/**
 * Location claim and movement trail validation.
 *
 * Validation is structural — it checks ranges and required fields, not
 * cryptographic validity or physical plausibility. Plausibility concerns
 * (accuracy, stale timestamps, impossible jumps) live in confidence.ts and
 * motion.ts.
 */

import type {
  GeoPoint,
  LocationChallenge,
  LocationClaim,
  LocationValidationResult,
  MovementTrail,
} from './types.js';
import { computeLocationClaimId } from './canonical.js';

/**
 * Create a LocationClaim with a content-derived claimId.
 * The claimId is computed from the stable fields (receivedAt, confidenceScore,
 * and metadata are excluded from the hash).
 */
export function createLocationClaim(input: Omit<LocationClaim, 'claimId'>): LocationClaim {
  return {
    ...input,
    claimId: computeLocationClaimId(input),
  };
}

function ok(): LocationValidationResult {
  return { valid: true, errors: [], warnings: [] };
}

export function validateGeoPoint(point: GeoPoint): LocationValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Number.isFinite(point.lat)) {
    errors.push('latitude must be finite');
  } else if (point.lat < -90 || point.lat > 90) {
    errors.push('latitude must be between -90 and 90');
  }

  if (!Number.isFinite(point.lon)) {
    errors.push('longitude must be finite');
  } else if (point.lon < -180 || point.lon > 180) {
    errors.push('longitude must be between -180 and 180');
  }

  if (point.altitudeM !== undefined && !Number.isFinite(point.altitudeM)) {
    errors.push('altitude must be finite');
  }

  if (point.accuracyM !== undefined) {
    if (!Number.isFinite(point.accuracyM)) {
      errors.push('accuracy must be finite');
    } else if (point.accuracyM < 0) {
      errors.push('accuracy must be non-negative');
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function isChallengeExpired(challenge: LocationChallenge, now: number): boolean {
  return challenge.expiresAt !== undefined && now > challenge.expiresAt;
}

export function validateLocationClaim(claim: LocationClaim): LocationValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const point = validateGeoPoint(claim.location);
  errors.push(...point.errors);
  warnings.push(...point.warnings);

  if (!Number.isFinite(claim.observedAt) || claim.observedAt <= 0) {
    errors.push('observedAt must be finite and positive');
  }
  if (claim.receivedAt !== undefined && !Number.isFinite(claim.receivedAt)) {
    errors.push('receivedAt must be finite');
  }
  if (typeof claim.subjectId !== 'string' || claim.subjectId.length === 0) {
    errors.push('subjectId is required');
  }
  if (typeof claim.deviceId !== 'string' || claim.deviceId.length === 0) {
    errors.push('deviceId is required');
  }
  if (!claim.source || typeof claim.source.type !== 'string' || claim.source.type.length === 0) {
    errors.push('source.type is required');
  }
  if (claim.claimId !== undefined && claim.claimId.length > 0 && !claim.claimId.startsWith('totem:location:')) {
    warnings.push('claimId does not use the totem:location: prefix');
  }

  if (claim.challenge) {
    if (typeof claim.challenge.nonce !== 'string' || claim.challenge.nonce.length === 0) {
      errors.push('challenge nonce cannot be empty');
    }
    if (!Number.isFinite(claim.challenge.issuedAt) || claim.challenge.issuedAt <= 0) {
      errors.push('challenge issuedAt must be finite and positive');
    }
    if (
      claim.challenge.expiresAt !== undefined &&
      !Number.isFinite(claim.challenge.expiresAt)
    ) {
      errors.push('challenge expiresAt must be finite');
    } else if (
      claim.challenge.expiresAt !== undefined &&
      claim.challenge.expiresAt < claim.challenge.issuedAt
    ) {
      errors.push('challenge expiresAt cannot be before issuedAt');
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateMovementTrail(trail: MovementTrail): LocationValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(trail.samples) || trail.samples.length === 0) {
    errors.push('movement trail must have at least one sample');
    return { valid: false, errors, warnings };
  }

  if (typeof trail.subjectId !== 'string' || trail.subjectId.length === 0) {
    errors.push('subjectId is required');
  }
  if (typeof trail.deviceId !== 'string' || trail.deviceId.length === 0) {
    errors.push('deviceId is required');
  }

  for (const sample of trail.samples) {
    if (!Number.isFinite(sample.observedAt) || sample.observedAt <= 0) {
      errors.push('sample observedAt must be finite and positive');
    }
    const point = validateGeoPoint(sample.location);
    errors.push(...point.errors);
  }

  for (let i = 1; i < trail.samples.length; i++) {
    if (trail.samples[i].observedAt < trail.samples[i - 1].observedAt) {
      errors.push('movement trail samples must be ordered by observedAt');
      break;
    }
  }

  if (!Number.isFinite(trail.startedAt) || trail.startedAt <= 0) {
    errors.push('startedAt must be finite and positive');
  }
  if (!Number.isFinite(trail.endedAt) || trail.endedAt <= 0) {
    errors.push('endedAt must be finite and positive');
  } else if (trail.startedAt > trail.endedAt) {
    errors.push('startedAt cannot be after endedAt');
  }

  return { valid: errors.length === 0, errors, warnings };
}
