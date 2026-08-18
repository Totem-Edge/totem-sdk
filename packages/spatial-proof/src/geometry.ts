/**
 * Pure TypeScript geometry helpers for @totemsdk/spatial-proof.
 *
 * COORDINATE ORDER: [lon, lat] in decimal degrees (GeoJSON / EPSG:4326).
 * All functions are deterministic and dependency-free. Where a calculation is
 * approximate (e.g. planar distance scaling near the poles), the result is
 * clearly labelled in the calling relation's uncertainty notes.
 *
 * No network, no storage, no GDAL, no PostGIS, no map rendering.
 */

import type {
  BoundingBox,
  Coordinate,
  GeoGeometry,
  GeoLineStringGeometry,
  GeoMultiPolygonGeometry,
  GeoPointGeometry,
  GeoPolygonGeometry,
  SpatialObject,
  SpatialValidationResult,
} from './types.js';

const EARTH_RADIUS_M = 6_371_000;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Meters per degree of latitude (equirectangular approximation). */
function metersPerDegreeLat(): number {
  return (Math.PI / 180) * EARTH_RADIUS_M;
}

/**
 * Meters per degree of longitude at a given latitude (equirectangular
 * approximation). Approximate and only valid for small distances.
 */
function metersPerDegreeLon(latDeg: number): number {
  return Math.cos(toRadians(latDeg)) * metersPerDegreeLat();
}

// ── Validation ───────────────────────────────────────────────────────────────

function ok(): SpatialValidationResult {
  return { valid: true, errors: [], warnings: [] };
}

/**
 * Validate a single [lon, lat] coordinate.
 * Returns an error if the coordinate is out of range or not finite.
 */
export function validateCoordinate(coord: Coordinate): SpatialValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(coord) || coord.length !== 2) {
    errors.push('coordinate must be a [lon, lat] pair');
    return { valid: false, errors, warnings };
  }
  const [lon, lat] = coord;
  if (!Number.isFinite(lon)) {
    errors.push('longitude must be finite');
  } else if (lon < -180 || lon > 180) {
    errors.push('longitude must be between -180 and 180');
  }
  if (!Number.isFinite(lat)) {
    errors.push('latitude must be finite');
  } else if (lat < -90 || lat > 90) {
    errors.push('latitude must be between -90 and 90');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Ring closure: the first and last points must be equal. When a ring is not
 * closed, it is rejected (see normalizePolygonRing for the deterministic
 * normalizer).
 */
export function isRingClosed(ring: Coordinate[]): boolean {
  if (ring.length < 2) return false;
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}

/**
 * Deterministic normalizer: if the ring is not closed, append a copy of the
 * first point. Idempotent for already-closed rings. The returned array is a
 * fresh copy — the input is never mutated.
 */
export function normalizePolygonRing(ring: Coordinate[]): Coordinate[] {
  if (isRingClosed(ring)) return [...ring];
  return [...ring.map((c) => [c[0], c[1]] as Coordinate), [ring[0][0], ring[0][1]] as Coordinate];
}

/**
 * Deterministic normalizer for a whole polygon: closes every ring.
 */
export function normalizePolygon(polygon: GeoPolygonGeometry): GeoPolygonGeometry {
  return {
    type: 'Polygon',
    coordinates: polygon.coordinates.map(normalizePolygonRing),
  };
}

/**
 * Validate a single geometry.
 *
 * Rules:
 *   - Point: 1 valid coordinate
 *   - LineString: at least 2 valid coordinates
 *   - Polygon: at least 4 points per ring; rings must be closed
 *   - MultiPolygon: at least 1 polygon, each valid
 */
export function validateGeometry(geometry: GeoGeometry): SpatialValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  switch (geometry.type) {
    case 'Point': {
      const point = validateCoordinate((geometry as GeoPointGeometry).coordinates);
      errors.push(...point.errors);
      warnings.push(...point.warnings);
      break;
    }
    case 'LineString': {
      const coords = (geometry as GeoLineStringGeometry).coordinates;
      if (coords.length < 2) {
        errors.push('LineString must have at least 2 points');
      }
      for (const c of coords) {
        const point = validateCoordinate(c);
        errors.push(...point.errors);
      }
      break;
    }
    case 'Polygon': {
      const rings = (geometry as GeoPolygonGeometry).coordinates;
      if (rings.length === 0) {
        errors.push('Polygon must have at least 1 ring');
      }
      for (const ring of rings) {
        if (ring.length < 4) {
          errors.push('Polygon ring must have at least 4 points including closing point');
        }
        if (!isRingClosed(ring)) {
          errors.push('Polygon ring must be closed (first point must equal last point)');
        }
        for (const c of ring) {
          const point = validateCoordinate(c);
          errors.push(...point.errors);
        }
      }
      break;
    }
    case 'MultiPolygon': {
      const polys = (geometry as GeoMultiPolygonGeometry).coordinates;
      if (polys.length === 0) {
        errors.push('MultiPolygon must contain at least 1 polygon');
      }
      for (const poly of polys) {
        const sub = validateGeometry({ type: 'Polygon', coordinates: poly });
        errors.push(...sub.errors);
        warnings.push(...sub.warnings);
      }
      break;
    }
    default:
      errors.push('unknown geometry type: ' + (geometry as { type: string }).type);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate a spatial object. CRS defaults to EPSG:4326; any other CRS
 * produces a warning (all geometry math here assumes WGS84 lon/lat).
 */
export function validateSpatialObject(obj: SpatialObject): SpatialValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof obj.spatialId !== 'string' || obj.spatialId.length === 0) {
    errors.push('spatialId is required');
  }
  if (typeof obj.kind !== 'string' || obj.kind.length === 0) {
    errors.push('kind is required');
  }
  const geo = validateGeometry(obj.geometry);
  errors.push(...geo.errors);
  warnings.push(...geo.warnings);

  const crs = obj.crs ?? 'EPSG:4326';
  if (crs !== 'EPSG:4326') {
    warnings.push(`CRS is ${crs}; geometry math assumes WGS84 (EPSG:4326) [lon, lat]`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Bounding boxes ───────────────────────────────────────────────────────────

/**
 * Compute the axis-aligned bounding box of any geometry. Handles Point,
 * LineString, Polygon, and MultiPolygon (multi-dimensional flattening).
 */
export function getBoundingBox(geometry: GeoGeometry): BoundingBox {
  const coords: Coordinate[] = [];
  const collect = (c: Coordinate): void => { coords.push(c); };

  switch (geometry.type) {
    case 'Point':
      collect((geometry as GeoPointGeometry).coordinates);
      break;
    case 'LineString':
      (geometry as GeoLineStringGeometry).coordinates.forEach(collect);
      break;
    case 'Polygon':
      (geometry as GeoPolygonGeometry).coordinates.forEach((ring) => ring.forEach(collect));
      break;
    case 'MultiPolygon':
      (geometry as GeoMultiPolygonGeometry).coordinates.forEach((poly) =>
        poly.forEach((ring) => ring.forEach(collect)),
      );
      break;
  }

  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLon, minLat, maxLon, maxLat };
}

/**
 * True when two bounding boxes share any area or edge.
 */
export function bboxIntersects(a: BoundingBox, b: BoundingBox): boolean {
  return !(a.maxLon < b.minLon || b.maxLon < a.minLon || a.maxLat < b.minLat || b.maxLat < a.minLat);
}

/**
 * True when box `a` fully covers box `b`.
 */
export function bboxCovers(a: BoundingBox, b: BoundingBox): boolean {
  return a.minLon <= b.minLon && a.maxLon >= b.maxLon && a.minLat <= b.minLat && a.maxLat >= b.maxLat;
}

// ── Distance ─────────────────────────────────────────────────────────────────

/**
 * Great-circle distance between two [lon, lat] points using the Haversine
 * formula. Approximate (spherical Earth, R = 6371 km).
 */
export function distanceMeters(a: Coordinate, b: Coordinate): number {
  const dLat = toRadians(b[1] - a[1]);
  const dLon = toRadians(b[0] - a[0]);
  const lat1 = toRadians(a[1]);
  const lat2 = toRadians(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Perpendicular distance from a point to a line segment defined by [a, b].
 * Uses an equirectangular local approximation scaled to meters — accurate for
 * short segments, approximate over large distances or near the poles.
 */
export function distancePointToSegmentMeters(
  point: Coordinate,
  a: Coordinate,
  b: Coordinate,
): number {
  const refLat = (point[1] + a[1] + b[1]) / 3;
  const mPerLon = metersPerDegreeLon(refLat);
  const mPerLat = metersPerDegreeLat();

  const px = point[0] * mPerLon;
  const py = point[1] * mPerLat;
  const ax = a[0] * mPerLon;
  const ay = a[1] * mPerLat;
  const bx = b[0] * mPerLon;
  const by = b[1] * mPerLat;

  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) {
    return Math.hypot(px - ax, py - ay);
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * Minimum distance from a point to a LineString.
 * Approximate: equirectangular scaling applied per segment.
 */
export function distancePointToLineStringMeters(
  point: Coordinate,
  line: GeoLineStringGeometry,
): number {
  let min = Infinity;
  for (let i = 1; i < line.coordinates.length; i++) {
    const d = distancePointToSegmentMeters(point, line.coordinates[i - 1], line.coordinates[i]);
    if (d < min) min = d;
  }
  return min === Infinity ? 0 : min;
}

// ── Point-in-polygon ─────────────────────────────────────────────────────────

/**
 * Ray-casting point-in-polygon test over the outer ring of a Polygon.
 * Uses a normalized (closed) copy of the ring. Approximate on the lon/lat
 * plane — fine for typical geofences; not geodesic.
 */
export function pointInPolygon(point: Coordinate, polygon: GeoPolygonGeometry): boolean {
  const ring = normalizePolygonRing(polygon.coordinates[0]);
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Point-in-MultiPolygon: true when the point is inside any of the polygons.
 */
export function pointInMultiPolygon(
  point: Coordinate,
  multi: GeoMultiPolygonGeometry,
): boolean {
  return multi.coordinates.some((poly) => pointInPolygon(point, { type: 'Polygon', coordinates: poly }));
}

// ── Boundary distance ────────────────────────────────────────────────────────

/**
 * True when a point is within `thresholdM` meters of any boundary ring of a
 * Polygon (outer ring and holes). Uses the equirectangular approximation.
 */
export function isPointNearBoundary(
  point: Coordinate,
  polygon: GeoPolygonGeometry,
  thresholdM: number,
): boolean {
  for (const rawRing of polygon.coordinates) {
    const ring = normalizePolygonRing(rawRing);
    for (let i = 1; i < ring.length; i++) {
      const d = distancePointToSegmentMeters(point, ring[i - 1], ring[i]);
      if (d <= thresholdM) return true;
    }
  }
  return false;
}