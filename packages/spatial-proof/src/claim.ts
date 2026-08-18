/**
 * Spatial relation claim construction for @totemsdk/spatial-proof.
 *
 * Includes spatialRelationFromLocationClaim, which bridges an
 * @totemsdk/location-proof LocationClaim into a spatial relation claim
 * without any circular dependency (spatial-proof → location-proof only).
 */

import type { LocationClaim } from '@totemsdk/location-proof';
import type {
  EvaluateSpatialRelationParams,
  SpatialObject,
  SpatialRelationClaim,
  SpatialRelationType,
} from './types.js';
import { evaluateSpatialRelation } from './relations.js';

/**
 * Derive a spatial relation claim from a location claim.
 *
 * The location claim's [lon, lat] is used as the subject Point geometry and
 * its claimId is recorded as the locationClaimId input, so the resulting
 * spatial claim provably references the location claim it was computed from.
 */
export function spatialRelationFromLocationClaim(params: {
  locationClaim: LocationClaim;
  spatialObject: SpatialObject;
  relation: SpatialRelationType;
  computedAt?: number;
  maxDistanceM?: number;
  metadata?: Record<string, unknown>;
}): SpatialRelationClaim {
  const { locationClaim, spatialObject, relation } = params;
  const location = locationClaim.location;

  const evalParams: EvaluateSpatialRelationParams = {
    subjectId: locationClaim.subjectId,
    subjectKind: 'location-claim',
    spatialObject,
    relation,
    subjectGeometry: {
      type: 'Point',
      coordinates: [location.lon, location.lat],
    },
    ...(params.computedAt !== undefined ? { computedAt: params.computedAt } : {}),
    ...(params.maxDistanceM !== undefined ? { maxDistanceM: params.maxDistanceM } : {}),
    ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
    locationClaimId: locationClaim.claimId,
  };

  return evaluateSpatialRelation(evalParams);
}

/**
 * Validate the structure of a spatial relation claim (does not re-evaluate the
 * geometry — verification of the proof envelope also checks the claim ID and
 * evidence hashes).
 */
export function validateSpatialRelationClaim(
  claim: SpatialRelationClaim,
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof claim.relationId !== 'string' || claim.relationId.length === 0) {
    errors.push('relationId is required');
  }
  if (typeof claim.subjectId !== 'string' || claim.subjectId.length === 0) {
    errors.push('subjectId is required');
  }
  if (typeof claim.spatialObjectId !== 'string' || claim.spatialObjectId.length === 0) {
    errors.push('spatialObjectId is required');
  }
  if (!claim.relation || typeof claim.relation !== 'string') {
    errors.push('relation is required');
  }
  if (!Number.isFinite(claim.computedAt) || claim.computedAt <= 0) {
    errors.push('computedAt must be finite and positive');
  }
  if (!claim.engine || typeof claim.engine.name !== 'string' || typeof claim.engine.algorithm !== 'string') {
    errors.push('engine (name + algorithm) is required');
  }
  if (!claim.inputs || typeof claim.inputs.spatialGeometryHash !== 'string') {
    errors.push('inputs.spatialGeometryHash is required');
  }
  if (!claim.result || typeof claim.result.matched !== 'boolean') {
    errors.push('result.matched is required');
  }
  if (claim.result.distanceM !== undefined && !Number.isFinite(claim.result.distanceM)) {
    errors.push('result.distanceM must be finite');
  }

  return { valid: errors.length === 0, errors, warnings };
}