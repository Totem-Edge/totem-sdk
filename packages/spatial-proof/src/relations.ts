/**
 * Spatial relation evaluation for @totemsdk/spatial-proof.
 *
 * evaluateSpatialRelation turns a subject geometry (point, route sample, or
 * footprint bbox) plus a spatial object into a deterministic SpatialRelationClaim.
 *
 * HONESTY RULE: any relation evaluated by an approximate algorithm (bounding
 * boxes instead of exact polygon intersection/coverage) MUST include an
 * explicit uncertainty note. This package never silently claims exactness
 * it did not compute.
 *
 * All functions are deterministic and dependency-free.
 */

import type {
  EvaluateSpatialRelationParams,
  GeoGeometry,
  GeoLineStringGeometry,
  GeoMultiPolygonGeometry,
  GeoPointGeometry,
  GeoPolygonGeometry,
  SpatialRelationClaim,
  SpatialRelationType,
} from './types.js';
import { computeGeometryHash, computeSpatialRelationId } from './canonical.js';
import {
  bboxCovers,
  bboxIntersects,
  distanceMeters,
  distancePointToLineStringMeters,
  distancePointToSegmentMeters,
  getBoundingBox,
  isPointNearBoundary,
  pointInMultiPolygon,
  pointInPolygon,
  validateSpatialObject,
} from './geometry.js';

const ENGINE_NAME = '@totemsdk/spatial-proof';
const ENGINE_VERSION = '0.1.0';

const BBOX_UNCERTAINTY =
  'Relation evaluated using bounding-box approximation; exact polygon intersection not implemented.';

function isPointGeometry(g: GeoGeometry): g is GeoPointGeometry {
  return g.type === 'Point';
}

function isPolygonGeometry(g: GeoGeometry): g is GeoPolygonGeometry {
  return g.type === 'Polygon';
}

function isMultiPolygonGeometry(g: GeoGeometry): g is GeoMultiPolygonGeometry {
  return g.type === 'MultiPolygon';
}

function isLineStringGeometry(g: GeoGeometry): g is GeoLineStringGeometry {
  return g.type === 'LineString';
}

function pointInside(g: GeoGeometry, point: GeoPointGeometry): boolean {
  if (isPolygonGeometry(g)) return pointInPolygon(point.coordinates, g);
  if (isMultiPolygonGeometry(g)) return pointInMultiPolygon(point.coordinates, g);
  return false;
}

/**
 * Evaluate a spatial relation and return a deterministic SpatialRelationClaim.
 *
 * The claim's relationId is content-derived from all fields except relationId
 * and metadata, so identical evaluations always produce the same ID.
 */
export function evaluateSpatialRelation(
  params: EvaluateSpatialRelationParams,
): SpatialRelationClaim {
  const { subjectId, subjectKind, spatialObject, relation, computedAt = Date.now() } = params;

  const validation = validateSpatialObject(spatialObject);
  if (!validation.valid) {
    throw new Error('invalid spatial object: ' + validation.errors.join('; '));
  }

  const spatialGeometryHash = computeGeometryHash(spatialObject.geometry);
  const subjectGeometryHash = params.subjectGeometry
    ? computeGeometryHash(params.subjectGeometry)
    : undefined;

  // NOTE: relationId is NOT computed here. It is stamped once, at the very end,
  // after every branch has finalised engine.algorithm and result, so recomputing
  // the claim ID from the emitted claim always reproduces it.
  const base: Omit<SpatialRelationClaim, 'relationId'> = {
    subjectId,
    subjectKind,
    spatialObjectId: spatialObject.spatialId,
    relation,
    computedAt,
    engine: { name: ENGINE_NAME, version: ENGINE_VERSION, algorithm: 'unknown' },
    inputs: {
      ...(subjectGeometryHash !== undefined ? { subjectGeometryHash } : {}),
      spatialGeometryHash,
      ...(params.subjectProofId !== undefined ? { subjectProofId: params.subjectProofId } : {}),
      ...(params.locationClaimId !== undefined ? { locationClaimId: params.locationClaimId } : {}),
      ...(params.rasterManifestId !== undefined ? { rasterManifestId: params.rasterManifestId } : {}),
    },
    result: { matched: false },
    ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
  };

  function emit(overrides: Partial<Omit<SpatialRelationClaim, 'relationId'>> = {}): SpatialRelationClaim {
    const body: Omit<SpatialRelationClaim, 'relationId'> = { ...base, ...overrides };
    return { ...body, relationId: computeSpatialRelationId(body) };
  }

  if (!params.subjectGeometry) {
    return emit({
      result: {
        matched: false,
        uncertainty: ['No subject geometry provided; relation could not be evaluated.'],
      },
    });
  }

  const subject = params.subjectGeometry;
  const obj = spatialObject.geometry;

  // ── inside / outside / entered_zone / exited_zone (point vs polygon) ───────
  if (relation === 'inside' || relation === 'entered_zone') {
    if (isPointGeometry(subject) && (isPolygonGeometry(obj) || isMultiPolygonGeometry(obj))) {
      const matched = pointInside(obj, subject);
      return emit({
        engine: { name: ENGINE_NAME, version: ENGINE_VERSION, algorithm: 'point-in-polygon (ray casting, planar)' },
        result: {
          matched,
          confidenceScore: matched ? 80 : 60,
          uncertainty: ['Point-in-polygon test is planar (lon/lat); not a geodesic test.'],
        },
      });
    }
    return emit({
      result: {
        matched: false,
        uncertainty: ['inside requires a Point subject and Polygon/MultiPolygon object.'],
      },
    });
  }

  if (relation === 'outside' || relation === 'exited_zone') {
    if (isPointGeometry(subject) && (isPolygonGeometry(obj) || isMultiPolygonGeometry(obj))) {
      const matched = !pointInside(obj, subject);
      return emit({
        engine: { name: ENGINE_NAME, version: ENGINE_VERSION, algorithm: 'point-in-polygon (ray casting, planar)' },
        result: {
          matched,
          confidenceScore: matched ? 80 : 60,
          uncertainty: ['Point-in-polygon test is planar (lon/lat); not a geodesic test.'],
        },
      });
    }
    return emit({
      result: {
        matched: false,
        uncertainty: ['outside requires a Point subject and Polygon/MultiPolygon object.'],
      },
    });
  }

  // ── within_distance (point vs point via Haversine) ─────────────────────────
  if (relation === 'within_distance') {
    if (isPointGeometry(subject) && isPointGeometry(obj)) {
      const distanceM = distanceMeters(subject.coordinates, obj.coordinates);
      const maxDistanceM = params.maxDistanceM ?? 0;
      return emit({
        engine: { name: ENGINE_NAME, version: ENGINE_VERSION, algorithm: 'haversine great-circle distance' },
        result: {
          matched: distanceM <= maxDistanceM,
          distanceM,
          confidenceScore: 95,
        },
      });
    }
    return emit({
      result: {
        matched: false,
        uncertainty: ['within_distance requires Point subject and Point object (Haversine).'],
      },
    });
  }

  // ── near_boundary (point vs polygon boundary) ──────────────────────────────
  if (relation === 'near_boundary') {
    if (isPointGeometry(subject) && (isPolygonGeometry(obj) || isMultiPolygonGeometry(obj))) {
      const polys = isMultiPolygonGeometry(obj) ? obj.coordinates.map((c) => ({ type: 'Polygon' as const, coordinates: c })) : [obj];
      const thresholdM = params.maxDistanceM ?? 0;
      let nearest = Infinity;
      let matched = false;
      for (const poly of polys) {
        const inside = pointInPolygon(subject.coordinates, poly);
        const near = isPointNearBoundary(subject.coordinates, poly, thresholdM);
        if (!inside && near) matched = true;
        // distance to nearest ring vertex as a rough distance figure
        for (const ring of poly.coordinates) {
          for (let i = 1; i < ring.length; i++) {
            const d = distancePointToSegmentMeters(subject.coordinates, ring[i - 1], ring[i]);
            if (!inside && d < nearest) nearest = d;
          }
        }
      }
      return emit({
        engine: { name: ENGINE_NAME, version: ENGINE_VERSION, algorithm: 'point-to-polygon-boundary distance (equirectangular approximation)' },
        result: {
          matched,
          ...(Number.isFinite(nearest) ? { distanceM: nearest } : {}),
          uncertainty: ['Boundary distance uses an equirectangular local approximation.'],
        },
      });
    }
    return emit({
      result: {
        matched: false,
        uncertainty: ['near_boundary requires a Point subject and Polygon/MultiPolygon object.'],
      },
    });
  }

  // ── on_route (point near LineString) ───────────────────────────────────────
  if (relation === 'on_route') {
    if (isPointGeometry(subject) && isLineStringGeometry(obj)) {
      const distanceM = distancePointToLineStringMeters(subject.coordinates, obj);
      const maxDistanceM = params.maxDistanceM ?? 0;
      return emit({
        engine: { name: ENGINE_NAME, version: ENGINE_VERSION, algorithm: 'point-to-LineString distance (equirectangular approximation)' },
        result: {
          matched: distanceM <= maxDistanceM,
          distanceM,
          confidenceScore: 85,
          uncertainty: ['Route distance uses an equirectangular approximation; adequate for short segments.'],
        },
      });
    }
    return emit({
      result: {
        matched: false,
        uncertainty: ['on_route requires a Point subject and LineString object.'],
      },
    });
  }

  // ── intersects / overlaps (bbox precheck; polygon relation where feasible) ─
  if (relation === 'intersects' || relation === 'overlaps') {
    const subBox = getBoundingBox(subject);
    const objBox = getBoundingBox(obj);
    const boxOk = bboxIntersects(subBox, objBox);
    // When both are polygons we can say more than the box: check vertices.
    const exact =
      isPolygonGeometry(subject) && (isPolygonGeometry(obj) || isMultiPolygonGeometry(obj))
        ? polygonIntersectsExact(subject, obj)
        : undefined;
    // A vertex-probe is still not a full intersection: crops can cross edges
    // without any vertex inside the other polygon.
    const matched = exact ?? boxOk;
    return emit({
      engine: { name: ENGINE_NAME, version: ENGINE_VERSION, algorithm: 'bbox precheck' + (exact !== undefined ? ' + polygon vertex probing' : '') },
      result: {
        matched,
        uncertainty: exact === undefined
          ? [BBOX_UNCERTAINTY]
          : ['Vertex probing is approximate; polygons that intersect without shared vertices may be misjudged.'],
      },
    });
  }

  // ── covers / covered_by (scene footprint bbox covers site boundary bbox) ──
  if (relation === 'covers' || relation === 'covered_by') {
    const subBox = getBoundingBox(subject);
    const objBox = getBoundingBox(obj);
    const matched = relation === 'covers' ? bboxCovers(subBox, objBox) : bboxCovers(objBox, subBox);
    return emit({
      engine: { name: ENGINE_NAME, version: ENGINE_VERSION, algorithm: 'bbox cover check' },
      result: {
        matched,
        uncertainty: [BBOX_UNCERTAINTY],
      },
    });
  }

  // ── unknown ────────────────────────────────────────────────────────────────
  return emit({
    result: {
      matched: false,
      uncertainty: [`Relation type '${relation}' is not supported.`],
    },
  });
}

function polygonIntersectsExact(subject: GeoPolygonGeometry, obj: GeoPolygonGeometry | GeoMultiPolygonGeometry): boolean {
  const objPolys = isMultiPolygonGeometry(obj) ? obj.coordinates.map((c) => ({ type: 'Polygon' as const, coordinates: c })) : [obj];
  for (const poly of objPolys) {
    for (const ring of subject.coordinates) {
      for (const v of ring) {
        if (pointInPolygon(v, poly)) return true;
      }
    }
    for (const ring of poly.coordinates) {
      for (const v of ring) {
        if (pointInPolygon(v, subject)) return true;
      }
    }
  }
  return false;
}