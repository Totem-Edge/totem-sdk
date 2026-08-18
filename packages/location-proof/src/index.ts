/**
 * @module @totemsdk/location-proof
 *
 * Generic location and movement proof primitives for Totem Edge.
 *
 * This package produces verifiable, signed location claims — it does NOT
 * prove absolute truth. It is device-neutral: drones, cars, robots, ships,
 * tractors, phones, gateways, weather stations, security devices, and
 * autonomous machines can all produce claims through this package.
 *
 * Pure package — no hardware drivers, no network, no storage.
 */

export type {
  LocationSourceType,
  DeviceClass,
  GeoPoint,
  LocationSource,
  LocationChallenge,
  LocationCorroboration,
  LocationClaim,
  MotionSample,
  MovementTrail,
  LocationValidationResult,
  LocationConfidenceOptions,
  LocationConfidenceResult,
  MotionOptions,
  ImpossibleJumpResult,
  CreateMovementTrailParams,
  CreateLocationProofParams,
  LocationProofVerifyResult,
} from './types.js';

export { canonicalJson, toHex } from './canonical.js';
export {
  hashLocationClaim,
  computeLocationClaimId,
  hashMovementTrail,
  computeMovementTrailId,
} from './canonical.js';

export {
  validateGeoPoint,
  validateLocationClaim,
  validateMovementTrail,
  isChallengeExpired,
  createLocationClaim,
} from './claim.js';

export { scoreLocationClaim } from './confidence.js';

export {
  distanceMeters,
  computeSpeedMps,
  detectImpossibleJumps,
  createMovementTrail,
} from './motion.js';

export {
  locationClaimToEvidenceRef,
  movementTrailToEvidenceRef,
  createUnsignedLocationProof,
  signLocationProof,
  signLocationProofWithLease,
  verifyLocationProof,
} from './proof.js';

export {
  locationClaimToProofGraphNode,
  locationProofToGraphEdges,
  addLocationClaimToGraph,
  addLocationProofToGraph,
} from './proofgraph.js';
