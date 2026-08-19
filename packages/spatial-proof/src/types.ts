/**
 * @totemsdk/spatial-proof — Type definitions
 *
 * Pure schema for geospatial relationship proofs.
 *
 * COORDINATE ORDER: GeoJSON order — [longitude, latitude] in decimal degrees
 * (WGS84 / EPSG:4326). This is the opposite of "lat, lon". All geometry
 * functions and hashes in this package assume [lon, lat].
 *
 * No network, no storage, no map rendering, no GIS engine dependency.
 */

export type Coordinate = [number, number]; // [lon, lat]

export type GeoGeometry =
  | GeoPointGeometry
  | GeoLineStringGeometry
  | GeoPolygonGeometry
  | GeoMultiPolygonGeometry;

export interface GeoPointGeometry {
  type: 'Point';
  coordinates: Coordinate;
}

export interface GeoLineStringGeometry {
  type: 'LineString';
  coordinates: Coordinate[];
}

export interface GeoPolygonGeometry {
  type: 'Polygon';
  coordinates: Coordinate[][];
}

export interface GeoMultiPolygonGeometry {
  type: 'MultiPolygon';
  coordinates: Coordinate[][][];
}

/** Optional feature-type geometry that can be normalized to bbox or points. */
export type SpatialSubjectGeometry = GeoGeometry;

export interface BoundingBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export type SpatialObjectKind =
  | 'site-boundary'
  | 'zone'
  | 'route'
  | 'scene-footprint'
  | 'asset-footprint'
  | 'restricted-area'
  | 'inspection-area'
  | 'custom';

export interface SpatialObject {
  spatialId: string;
  kind: SpatialObjectKind;
  geometry: GeoGeometry;
  crs?: 'EPSG:4326' | string;
  name?: string;
  metadata?: Record<string, unknown>;
}

export type SpatialRelationType =
  | 'inside'
  | 'outside'
  | 'intersects'
  | 'overlaps'
  | 'covers'
  | 'covered_by'
  | 'within_distance'
  | 'near_boundary'
  | 'on_route'
  | 'entered_zone'
  | 'exited_zone'
  | 'unknown';

export interface EngineInfo {
  name: string;
  version: string;
  algorithm: string;
}

export interface SpatialRelationClaimInputs {
  /** totem:geo:<hex> hash of the subject geometry (when supplied). */
  subjectGeometryHash?: string;
  /** totem:geo:<hex> hash of the spatial object's geometry. */
  spatialGeometryHash: string;
  /** Optional subject proof ID the geometry was derived from. */
  subjectProofId?: string;
  /** Optional location claim ID the geometry was derived from. */
  locationClaimId?: string;
  /** Optional raster/scene manifest ID the geometry was derived from. */
  rasterManifestId?: string;
}

export interface SpatialRelationClaimResult {
  matched: boolean;
  distanceM?: number;
  confidenceScore?: number;
  /**
   * Explicit notes on approximation. Present whenever a relation was
   * evaluated with an approximate algorithm (e.g. bbox-only). Honesty is
   * critical — the package never silently claims exactness.
   */
  uncertainty?: string[];
}

export interface SpatialRelationClaim {
  relationId: string;
  subjectId: string;
  subjectKind: string;
  spatialObjectId: string;
  relation: SpatialRelationType;
  computedAt: number;
  engine: EngineInfo;
  inputs: SpatialRelationClaimInputs;
  result: SpatialRelationClaimResult;
  metadata?: Record<string, unknown>;
}

export interface SpatialValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface EvaluateSpatialRelationParams {
  subjectId: string;
  subjectKind: string;
  spatialObject: SpatialObject;
  relation: SpatialRelationType;
  subjectGeometry?: SpatialSubjectGeometry;
  /** Required for distance-based relations (within_distance, on_route, near_boundary). */
  maxDistanceM?: number;
  computedAt?: number;
  subjectProofId?: string;
  locationClaimId?: string;
  rasterManifestId?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateSpatialProofParams {
  claim: SpatialRelationClaim;
  /** Full spatial object used to compute its evidence hash. */
  spatialObject: SpatialObject;
  /** Optional subject geometry used to add a geometry evidence ref. */
  subjectGeometry?: GeoGeometry;
  issuer?: string;
  issuedAt?: number;
  expiresAt?: number;
}

export interface SpatialProofVerifyResult {
  valid: boolean;
  reason?: string;
  signerAddress?: string;
  spatialObjectId?: string;
  relationId?: string;
  payloadValid?: boolean;
  evidenceHashValid?: boolean;
  relationIdValid?: boolean;
}