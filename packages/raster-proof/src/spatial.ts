/**
 * @totemsdk/spatial-proof integration for @totemsdk/raster-proof.
 *
 * Bridges a raster manifest's bounds into a @totemsdk/spatial-proof
 * SpatialObject and evaluates spatial relations (covers, intersects,
 * overlaps, covered_by, …) against site boundaries, zones, routes, scene
 * footprints and inspection areas. All geometry math is delegated to
 * @totemsdk/spatial-proof — nothing here is reimplemented.
 */

import {
  computeSpatialObjectId,
  evaluateSpatialRelation,
} from '@totemsdk/spatial-proof';
import type {
  SpatialObject,
  SpatialRelationClaim,
  SpatialRelationType,
  GeoPolygonGeometry,
} from '@totemsdk/spatial-proof';
import type {
  CreateRasterSpatialRelationParams,
  RasterManifest,
} from './types.js';

/**
 * Build a bbox Polygon (GeoJSON [lon, lat], closed ring) from manifest bounds.
 */
function footprintPolygon(bounds: [number, number, number, number]): GeoPolygonGeometry {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  return {
    type: 'Polygon',
    coordinates: [[
      [minLon, minLat],
      [maxLon, minLat],
      [maxLon, maxLat],
      [minLon, maxLat],
      [minLon, minLat],
    ]],
  };
}

/**
 * Convert a raster manifest into a spatial object footprint, or null when the
 * manifest has no bounds (nothing to georeference).
 */
export function rasterFootprintToSpatialObject(manifest: RasterManifest): SpatialObject | null {
  const bounds = manifest.spatial?.bounds;
  if (!bounds || bounds.length !== 4) {
    return null;
  }
  const geometry = footprintPolygon(bounds);
  const body = {
    kind: 'scene-footprint' as const,
    geometry,
    ...(manifest.spatial?.crs !== undefined ? { crs: manifest.spatial.crs } : {}),
    ...(manifest.spatial?.spatialObjectId !== undefined ? { spatialId: manifest.spatial.spatialObjectId } : {}),
    ...(manifest.rasterId !== undefined ? { name: `raster ${manifest.rasterId}` } : {}),
  };
  const spatialObject: SpatialObject = {
    ...body,
    spatialId: body.spatialId ?? computeSpatialObjectId(body),
  };
  return spatialObject;
}

/**
 * Evaluate a spatial relation between a raster footprint and a spatial
 * object, producing a deterministic SpatialRelationClaim via
 * @totemsdk/spatial-proof. Requires the manifest to have bounds.
 */
export function createRasterSpatialRelation(
  params: CreateRasterSpatialRelationParams,
): SpatialRelationClaim {
  const { manifest, spatialObject, relation, computedAt, maxDistanceM, subjectProofId, metadata } = params;

  const bounds = manifest.spatial?.bounds;
  if (!bounds || bounds.length !== 4) {
    throw new Error('createRasterSpatialRelation requires manifest.spatial.bounds');
  }

  return evaluateSpatialRelation({
    subjectId: manifest.rasterId,
    subjectKind: 'raster-manifest',
    spatialObject,
    relation,
    subjectGeometry: footprintPolygon(bounds),
    rasterManifestId: manifest.rasterId,
    ...(computedAt !== undefined ? { computedAt } : {}),
    ...(maxDistanceM !== undefined ? { maxDistanceM } : {}),
    ...(subjectProofId !== undefined ? { subjectProofId } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  });
}

export type { SpatialRelationType };
