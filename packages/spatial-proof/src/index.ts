/**
 * @module @totemsdk/spatial-proof
 *
 * Generic geospatial relationship proof primitives for Totem Edge.
 *
 * Answers "how does this proof, device, asset, observation, raster, image,
 * route, or event relate to a known spatial object?" — inside a site boundary,
 * covering a polygon, near a boundary, on a route, overlapping a zone, etc.
 *
 * This is a pure schema/calculation/proof package:
 *
 *   geometry + subject + relation + computation metadata
 *   → deterministic spatial relation claim
 *   → evidence hash
 *   → Totem proof envelope
 *   → proofgraph linkage
 *
 * No network, no storage, no map rendering, no GDAL, no PostGIS, no external
 * API. All geometry math is deterministic; where a calculation is approximate
 * (e.g. bounding-box-only relations) the uncertainty is explicit in the output.
 *
 * COORDINATE ORDER: [lon, lat] (GeoJSON / EPSG:4326).
 */

export type {
  Coordinate,
  GeoGeometry,
  GeoPointGeometry,
  GeoLineStringGeometry,
  GeoPolygonGeometry,
  GeoMultiPolygonGeometry,
  BoundingBox,
  SpatialObjectKind,
  SpatialObject,
  SpatialRelationType,
  EngineInfo,
  SpatialRelationClaimInputs,
  SpatialRelationClaimResult,
  SpatialRelationClaim,
  SpatialValidationResult,
  EvaluateSpatialRelationParams,
  CreateSpatialProofParams,
  SpatialProofVerifyResult,
} from './types.js';

export { canonicalJson, toHex } from './canonical.js';
export {
  computeGeometryHash,
  computeSpatialObjectId,
  computeSpatialRelationId,
  hashSpatialObject,
  hashSpatialRelationClaim,
} from './canonical.js';

export {
  validateCoordinate,
  validateGeometry,
  validateSpatialObject,
  getBoundingBox,
  bboxIntersects,
  bboxCovers,
  distanceMeters,
  distancePointToSegmentMeters,
  distancePointToLineStringMeters,
  pointInPolygon,
  pointInMultiPolygon,
  isPointNearBoundary,
  isRingClosed,
  normalizePolygonRing,
  normalizePolygon,
} from './geometry.js';

export { evaluateSpatialRelation } from './relations.js';

export {
  spatialRelationFromLocationClaim,
  validateSpatialRelationClaim,
} from './claim.js';

export {
  spatialObjectToEvidenceRef,
  spatialRelationToEvidenceRef,
  spatialClaimEvidenceRefs,
  createUnsignedSpatialProof,
  signSpatialProof,
  verifySpatialProof,
} from './proof.js';

export {
  spatialObjectToProofGraphNode,
  spatialRelationToProofGraphNode,
  spatialRelationToGraphEdges,
  addSpatialRelationToGraph,
} from './proofgraph.js';