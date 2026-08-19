/**
 * @totemsdk/location-proof — Type definitions
 *
 * Pure schema — device-neutral signed location and movement claims.
 * No hardware drivers, no network, no storage.
 */

export type LocationSourceType =
  | 'gnss'
  | 'gps'
  | 'rtk'
  | 'cell'
  | 'wifi'
  | 'ble'
  | 'lorawan'
  | 'gateway'
  | 'network'
  | 'manual'
  | 'derived'
  | 'other';

export type DeviceClass =
  | 'drone'
  | 'vehicle'
  | 'robot'
  | 'ship'
  | 'tractor'
  | 'phone'
  | 'sensor'
  | 'gateway'
  | 'camera'
  | 'weather-station'
  | 'security-device'
  | 'other';

export interface GeoPoint {
  lat: number;
  lon: number;
  altitudeM?: number;
  accuracyM?: number;
}

export interface LocationSource {
  type: LocationSourceType;
  fixType?: string;
  satellitesUsed?: number;
  hdop?: number;
  vdop?: number;
  pdop?: number;
  rawPayloadHash?: string;
  nmeaPayloadHash?: string;
  spoofingFlag?: boolean;
  jammingFlag?: boolean;
  metadata?: Record<string, unknown>;
}

export interface LocationChallenge {
  nonce: string;
  issuedAt: number;
  expiresAt?: number;
  verifierId: string;
}

export interface LocationCorroboration {
  beaconsSeen?: string[];
  wifiFingerprints?: string[];
  cellTowers?: string[];
  lorawanGateways?: string[];
  networkProfileId?: string;
  nearbyDeviceProofIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface LocationClaim {
  claimId: string;
  subjectId: string;
  deviceId: string;
  deviceClass?: DeviceClass;
  operatorId?: string;
  observedAt: number;
  receivedAt?: number;
  location: GeoPoint;
  source: LocationSource;
  challenge?: LocationChallenge;
  corroboration?: LocationCorroboration;
  confidenceScore?: number;
  uncertainty?: string[];
  metadata?: Record<string, unknown>;
}

export interface MotionSample {
  observedAt: number;
  location: GeoPoint;
  headingDeg?: number;
  speedMps?: number;
  accuracyM?: number;
  source?: LocationSource;
}

export interface MovementTrail {
  trailId: string;
  subjectId: string;
  deviceId: string;
  samples: MotionSample[];
  startedAt: number;
  endedAt: number;
  maxComputedSpeedMps?: number;
  impossibleJumpDetected?: boolean;
  metadata?: Record<string, unknown>;
}

export interface LocationValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface LocationConfidenceOptions {
  /** accuracyM at or below this value is considered strong (default 10m) */
  accuracyThresholdM?: number;
  /** accuracyM above this value is considered weak (default 3x accuracyThresholdM) */
  weakAccuracyThresholdM?: number;
  /** a claim older than maxAgeMs is considered stale (default 300_000) */
  maxAgeMs?: number;
  /** explicit "now" timestamp for deterministic scoring (default Date.now()) */
  now?: number;
  /** satellite count at or above this value is considered strong (default 8) */
  strongSatellites?: number;
  /** HDOP at or below this value is considered low (default 2) */
  strongHdop?: number;
}

export interface LocationConfidenceResult {
  score: number;
  level: 'none' | 'weak' | 'moderate' | 'strong' | 'high';
  positiveSignals: string[];
  negativeSignals: string[];
}

export interface MotionOptions {
  /** speed threshold in m/s above which a segment is an impossible jump (default 100) */
  maxSpeedMps?: number;
}

export interface ImpossibleJumpResult {
  impossible: boolean;
  maxSpeedMps: number;
  jumps: Array<{
    fromIndex: number;
    toIndex: number;
    speedMps: number;
    distanceM: number;
    deltaSeconds: number;
  }>;
}

export interface CreateMovementTrailParams {
  trailId?: string;
  subjectId: string;
  deviceId: string;
  samples: MotionSample[];
  metadata?: Record<string, unknown>;
  /** override for the impossible-jump speed threshold in m/s (default 100) */
  maxSpeedMps?: number;
}

export interface CreateLocationProofParams {
  claim: LocationClaim;
  /** proof issuer; defaults to claim.subjectId */
  issuer?: string;
  issuedAt?: number;
  expiresAt?: number;
}

export interface LocationProofVerifyResult {
  valid: boolean;
  reason?: string;
  expired?: boolean;
  signerAddress?: string;
  claimId?: string;
  payloadValid?: boolean;
  evidenceHashValid?: boolean;
}
