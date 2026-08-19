/**
 * Deterministic confidence scoring for location claims.
 *
 * The score is a 0–100 heuristic over structured signals. It is NOT a measure
 * of absolute truth — it quantifies how well-corroborated a claim is. No
 * randomness is used; the same claim always produces the same score.
 *
 * An "impossible movement jump" is signalled on the claim via
 * claim.metadata.impossibleJumpDetected === true or
 * claim.corroboration.metadata.impossibleJumpDetected === true (set by
 * createMovementTrail / detectImpossibleJumps).
 */

import type {
  LocationClaim,
  LocationConfidenceOptions,
  LocationConfidenceResult,
} from './types.js';
import { isChallengeExpired } from './claim.js';

const DEFAULTS = {
  accuracyThresholdM: 10,
  maxAgeMs: 300_000,
  strongSatellites: 8,
  strongHdop: 2,
};

function levelFor(score: number): LocationConfidenceResult['level'] {
  if (score >= 80) return 'high';
  if (score >= 60) return 'strong';
  if (score >= 40) return 'moderate';
  if (score >= 20) return 'weak';
  return 'none';
}

function hasCorroboration(claim: LocationClaim): boolean {
  const c = claim.corroboration;
  if (!c) return false;
  return Boolean(
    (c.beaconsSeen?.length ?? 0) > 0 ||
      (c.lorawanGateways?.length ?? 0) > 0 ||
      (c.cellTowers?.length ?? 0) > 0 ||
      (c.wifiFingerprints?.length ?? 0) > 0,
  );
}

function hasImpossibleJumpSignal(claim: LocationClaim): boolean {
  if (claim.metadata?.impossibleJumpDetected === true) return true;
  if (claim.corroboration?.metadata?.impossibleJumpDetected === true) return true;
  return false;
}

export function scoreLocationClaim(
  claim: LocationClaim,
  options: LocationConfidenceOptions = {},
): LocationConfidenceResult {
  const opts = {
    accuracyThresholdM: options.accuracyThresholdM ?? DEFAULTS.accuracyThresholdM,
    weakAccuracyThresholdM: options.weakAccuracyThresholdM ?? (options.accuracyThresholdM ?? DEFAULTS.accuracyThresholdM) * 3,
    maxAgeMs: options.maxAgeMs ?? DEFAULTS.maxAgeMs,
    now: options.now ?? Date.now(),
    strongSatellites: options.strongSatellites ?? DEFAULTS.strongSatellites,
    strongHdop: options.strongHdop ?? DEFAULTS.strongHdop,
  };

  let score = 50;
  const positiveSignals: string[] = [];
  const negativeSignals: string[] = [];

  const source = claim.source;
  const accuracy = claim.location.accuracyM;
  const hasDevice = typeof claim.deviceId === 'string' && claim.deviceId.length > 0;
  const ageMs = opts.now - claim.observedAt;

  // ── Positive signals ──────────────────────────────────────────────────────
  if (hasDevice) {
    score += 8;
    positiveSignals.push('deviceId present');
  }
  if (accuracy !== undefined && accuracy <= opts.accuracyThresholdM) {
    score += 12;
    positiveSignals.push('accuracy within threshold');
  }
  if (source && (source.type === 'gnss' || source.type === 'gps' || source.type === 'rtk')) {
    score += 10;
    positiveSignals.push('GNSS/RTK source');
  }
  if (source && source.satellitesUsed !== undefined) {
    score += 2;
    positiveSignals.push('satellite count present');
    if (source.satellitesUsed >= opts.strongSatellites) {
      score += 4;
      positiveSignals.push('strong satellite count');
    }
  }
  if (source && source.hdop !== undefined && source.hdop <= opts.strongHdop) {
    score += 6;
    positiveSignals.push('low HDOP');
  }
  if (claim.challenge) {
    const nonceOk = claim.challenge.nonce.length > 0;
    const expired = isChallengeExpired(claim.challenge, opts.now);
    if (nonceOk && !expired) {
      score += 8;
      positiveSignals.push('valid nonce challenge');
    } else if (expired) {
      score -= 12;
      negativeSignals.push('expired challenge');
    }
  }
  if (hasCorroboration(claim)) {
    score += 5;
    positiveSignals.push('beacon/gateway corroboration present');
  }
  if (source && source.rawPayloadHash) {
    score += 4;
    positiveSignals.push('raw payload hash present');
  }
  if (source && source.spoofingFlag !== true) {
    score += 5;
    positiveSignals.push('no spoofing flag');
  }
  if (source && source.jammingFlag !== true) {
    score += 5;
    positiveSignals.push('no jamming flag');
  }

  // ── Negative signals ──────────────────────────────────────────────────────
  if (source && source.type === 'manual') {
    score -= 15;
    negativeSignals.push('manual source only');
  }
  if (accuracy !== undefined && accuracy > opts.weakAccuracyThresholdM) {
    score -= 10;
    negativeSignals.push('weak accuracy');
  }
  if (ageMs > opts.maxAgeMs) {
    score -= 10;
    negativeSignals.push('stale timestamp');
  }
  if (claim.challenge && isChallengeExpired(claim.challenge, opts.now)) {
    score -= 12;
    negativeSignals.push('expired challenge');
  }
  if (source && source.spoofingFlag === true) {
    score -= 20;
    negativeSignals.push('spoofing flag set');
  }
  if (source && source.jammingFlag === true) {
    score -= 15;
    negativeSignals.push('jamming flag set');
  }
  if (
    source &&
    (source.type === 'gnss' || source.type === 'gps' || source.type === 'rtk') &&
    source.satellitesUsed === undefined &&
    source.hdop === undefined &&
    !source.fixType
  ) {
    score -= 8;
    negativeSignals.push('missing source quality');
  }
  if (!hasDevice) {
    score -= 10;
    negativeSignals.push('no device ID');
  }
  if (hasImpossibleJumpSignal(claim)) {
    score -= 20;
    negativeSignals.push('impossible movement jump');
  }

  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: clamped,
    level: levelFor(clamped),
    positiveSignals,
    negativeSignals,
  };
}
