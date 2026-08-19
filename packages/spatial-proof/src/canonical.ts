/**
 * Canonical JSON, hashing, and stable ID rules for @totemsdk/spatial-proof.
 *
 * canonicalJson and toHex are re-exported from @totemsdk/proof, which is the
 * canonical implementation across the Totem SDK (deterministic canonical JSON
 * with recursively sorted keys, lowercase hex without 0x prefix).
 *
 * ID rules:
 *   Geometry:      "totem:geo:"     + sha3_256("totem-geometry" + canonicalJson(geometry))
 *   Spatial object:"totem:spatial:" + sha3_256("totem-spatial-object" + canonicalJson(stableObject))
 *   Relation claim:"totem:spatial:" + sha3_256("totem-spatial-relation" + canonicalJson(stableRelation))
 *
 * Stable IDs deliberately exclude mutable / non-content fields so equivalent
 * logical content always produces the same identifier:
 *   spatial object: spatialId, metadata
 *   relation claim: relationId, metadata (result and computedAt are content —
 *                   a re-evaluation is a new observation of a relationship).
 *
 * COORDINATE ORDER is [lon, lat] (GeoJSON / EPSG:4326).
 */

import { sha3_256 } from '@totemsdk/core';
import { canonicalJson, toHex } from '@totemsdk/proof';
import type { GeoGeometry, SpatialObject, SpatialRelationClaim } from './types.js';

export { canonicalJson, toHex };

const GEOMETRY_PREFIX = 'totem-geometry';
const SPATIAL_OBJECT_PREFIX = 'totem-spatial-object';
const SPATIAL_RELATION_PREFIX = 'totem-spatial-relation';

function stableSpatialObjectInput(input: Omit<SpatialObject, 'spatialId'>): Record<string, unknown> {
  const { spatialId: _spatialId, metadata: _metadata, ...stable } = input as SpatialObject;
  return stable as unknown as Record<string, unknown>;
}

function stableRelationInput(input: Omit<SpatialRelationClaim, 'relationId'>): Record<string, unknown> {
  const { relationId: _relationId, metadata: _metadata, ...stable } = input as SpatialRelationClaim;
  return stable as unknown as Record<string, unknown>;
}

function hashStableGeometry(geometry: GeoGeometry): string {
  const digest = sha3_256(new TextEncoder().encode(GEOMETRY_PREFIX + canonicalJson(geometry)));
  return toHex(digest);
}

function hashStableSpatialObject(input: Omit<SpatialObject, 'spatialId'>): string {
  const digest = sha3_256(new TextEncoder().encode(SPATIAL_OBJECT_PREFIX + canonicalJson(stableSpatialObjectInput(input))));
  return toHex(digest);
}

function hashStableRelation(input: Omit<SpatialRelationClaim, 'relationId'>): string {
  const digest = sha3_256(new TextEncoder().encode(SPATIAL_RELATION_PREFIX + canonicalJson(stableRelationInput(input))));
  return toHex(digest);
}

/**
 * Compute the stable geometry identifier: "totem:geo:<sha3-256-hex>".
 * Deterministic over the exact geometry — the same geometry always hashes
 * to the same identifier.
 */
export function computeGeometryHash(geometry: GeoGeometry): string {
  return 'totem:geo:' + hashStableGeometry(geometry);
}

/**
 * Compute a stable URI-style spatial object ID: "totem:spatial:<sha3-256-hex>".
 * Callers pass the object minus spatialId; metadata is excluded internally.
 */
export function computeSpatialObjectId(input: Omit<SpatialObject, 'spatialId'>): string {
  return 'totem:spatial:' + hashStableSpatialObject(input);
}

/**
 * Compute a stable URI-style spatial relation claim ID using the same
 * "totem:spatial:" namespace as spatial objects. Relation and object hashes
 * are distinguishable by their content-derived preimage, so the shared prefix
 * cannot cause an ID collision for equivalent logical content.
 */
export function computeSpatialRelationId(input: Omit<SpatialRelationClaim, 'relationId'>): string {
  return 'totem:spatial:' + hashStableRelation(input);
}

/**
 * Hash a complete SpatialObject (excluding spatialId and metadata)
 * to lowercase SHA3-256 hex without a 0x prefix — the value used in
 * EvidenceRef.hash.
 */
export function hashSpatialObject(obj: SpatialObject): string {
  const { spatialId: _spatialId, ...rest } = obj;
  return hashStableSpatialObject(rest);
}

/**
 * Hash a complete SpatialRelationClaim (excluding relationId and metadata)
 * to lowercase SHA3-256 hex without a 0x prefix — the value used in
 * EvidenceRef.hash.
 */
export function hashSpatialRelationClaim(claim: SpatialRelationClaim): string {
  const { relationId: _relationId, ...rest } = claim;
  return hashStableRelation(rest);
}