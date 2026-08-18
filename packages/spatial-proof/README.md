# @totemsdk/spatial-proof

Generic spatial relationship proof primitives for Totem Edge — geometry hashes, geofence relations, route checks, and proof envelope integration.

No network. No storage. No map rendering. No GDAL. No PostGIS. No external API. Pure schema, calculation, and proof primitives.

## What this package does

`@totemsdk/spatial-proof` answers one question:

> "How does this proof, device, asset, observation, raster, image, route, or event relate to a known spatial object?"

For example:

- a location claim is **inside** a site boundary
- a drone flight **covered** a polygon
- a ship **entered** a maritime zone
- a robot **stayed** inside its permitted work area
- a vehicle **followed** an approved route
- a weather sensor is **within distance** of a construction-site geofence
- a satellite scene footprint **covers** a project boundary
- a derived flood mask **overlaps** a work zone

It is not ZEDD-specific. ZEDD, Wajibika, AgriPulse, Guardbase, logistics, robotics, maritime, drones, and autonomous vehicles can all use it.

## What this package does NOT prove

This package produces deterministic geospatial relation claims, not absolute geodetic truth. Where a calculation is approximate, the claim's `result.uncertainty` says so explicitly.

- **Bounding-box relations** (`intersects`, `overlaps`, `covers`, `covered_by`) are computed on axis-aligned bounding boxes and are **not** exact polygon intersections or coverages — the claim always carries a bounding-box uncertainty note.
- **Planar geometry** — point-in-polygon, boundary distance, and route distance use planar/equirectangular math on lon/lat. Fine for typical geofences; not geodesic.
- **No GIS engine parity** — no projections, topology, topology repair, or full polygon boolean operations.

Out of scope (intentionally):

- GPS hardware drivers, satellite APIs, map services, drone telemetry → those live in transport/device packages
- Raster/image processing → future `@totemsdk/raster-proof`
- Map rendering, database storage, network calls, legal claims engines

## Installation

```bash
npm install @totemsdk/spatial-proof
```

## Coordinate order (READ FIRST)

**All coordinates are `[lon, lat]`** — GeoJSON order (WGS84 / EPSG:4326), NOT `[lat, lon]`. This is the opposite of the `{ lat, lon }` shape used by `@totemsdk/location-proof`.

```typescript
import { pointInPolygon } from '@totemsdk/spatial-proof';

const site = {
  type: 'Polygon' as const,
  coordinates: [[
    [0, 0], [0, 1], [1, 1], [1, 0], [0, 0], // [lon, lat]
  ]],
};

pointInPolygon([0.5, 0.5], site); // true — lon 0.5, lat 0.5
pointInPolygon([5, 5], site);     // false
```

## Package scope

- GeoJSON-like `Point`, `LineString`, `Polygon`, `MultiPolygon` in `[lon, lat]`
- Axis-aligned bounding boxes and bbox intersection/coverage
- WGS84 / EPSG:4326 metadata (any other CRS produces a validation warning)
- Geometry hashing (`totem:geo:…`)
- Spatial object IDs (`totem:spatial:…`)
- Point-in-polygon, point distance, point-near-boundary, point-on-route
- Polygon overlap via bbox precheck plus polygon vertex probing (approximate)
- `covers` for scene footprints over site boundaries
- Deterministic relation claims with explicit uncertainty notes
- `@totemsdk/proof` evidence refs, unsigned proof creation, WOTS signing, and end-to-end verification
- `@totemsdk/proofgraph` node/edge helpers
- `@totemsdk/location-proof` integration (one-directional dependency)

## API table

### IDs and hashing

| Export | Description |
|--------|-------------|
| `canonicalJson(value)` | Deterministic canonical JSON — recursively sorted keys |
| `toHex(bytes)` | Uint8Array → lowercase hex (no `0x`) |
| `computeGeometryHash(geometry)` | Stable geometry ID `totem:geo:<sha3-256-hex>` |
| `computeSpatialObjectId(input)` | Stable object ID `totem:spatial:<sha3-256-hex>` |
| `computeSpatialRelationId(input)` | Stable relation ID `totem:spatial:<sha3-256-hex>` |
| `hashSpatialObject(obj)` | SHA3-256 hex of an object's stable fields |
| `hashSpatialRelationClaim(claim)` | SHA3-256 hex of a claim's stable fields |

### Geometry

| Export | Description |
|--------|-------------|
| `validateCoordinate(coord)` | Range-check a `[lon, lat]` coordinate |
| `validateGeometry(geometry)` | Structural validation (ring closure, min points, ranges) |
| `validateSpatialObject(obj)` | Object validation (geometry + CRS warnings) |
| `getBoundingBox(geometry)` | Axis-aligned bounding box of any geometry |
| `bboxIntersects(a, b)` | Bbox overlap test |
| `bboxCovers(a, b)` | Bbox containment test |
| `distanceMeters(a, b)` | Haversine great-circle distance in meters |
| `distancePointToSegmentMeters(p, a, b)` | Perpendicular distance point → segment |
| `distancePointToLineStringMeters(p, line)` | Minimum distance point → LineString |
| `pointInPolygon(p, polygon)` | Ray-casting point-in-polygon (outer ring) |
| `pointInMultiPolygon(p, multi)` | Point in any polygon of a MultiPolygon |
| `isPointNearBoundary(p, polygon, thresholdM)` | Point within `thresholdM` of a boundary ring |
| `isRingClosed(ring)` | Check ring closure |
| `normalizePolygonRing(ring)` | Deterministically close a ring (immutable) |
| `normalizePolygon(polygon)` | Deterministically close all rings (immutable) |

### Relation evaluation

| Export | Description |
|--------|-------------|
| `evaluateSpatialRelation(params)` | Deterministic relation claim from subject + spatial object |
| `validateSpatialRelationClaim(claim)` | Structural validation of a relation claim |

### Location-proof integration

| Export | Description |
|--------|-------------|
| `spatialRelationFromLocationClaim(params)` | Derive a relation claim from a `LocationClaim` |

### Proof integration

| Export | Description |
|--------|-------------|
| `spatialObjectToEvidenceRef(obj)` | Object → `EvidenceRef` |
| `spatialRelationToEvidenceRef(claim)` | Claim → `EvidenceRef` |
| `spatialClaimEvidenceRefs(claim, obj, subjectGeometry?)` | Full evidence ref list for a spatial proof |
| `createUnsignedSpatialProof(params)` | Build an unsigned `attestation` proof |
| `signSpatialProof(unsigned, seed, keyIndex)` | WOTS-sign the proof |
| `verifySpatialProof(signed)` | Full end-to-end verification |

### Proofgraph integration

| Export | Description |
|--------|-------------|
| `spatialObjectToProofGraphNode(obj)` | Object → `custom` `ProofGraphNode` |
| `spatialRelationToProofGraphNode(claim)` | Claim → `custom` `ProofGraphNode` |
| `spatialRelationToGraphEdges(claim)` | Claim → `about` / `references` / `derived_from` edges |
| `addSpatialRelationToGraph(graph, claim)` | Immutably add a claim node |

## Type reference

### `Coordinate` and `GeoGeometry`

```typescript
type Coordinate = [number, number]; // [lon, lat]

type GeoGeometry =
  | { type: 'Point'; coordinates: Coordinate }
  | { type: 'LineString'; coordinates: Coordinate[] }
  | { type: 'Polygon'; coordinates: Coordinate[][] }        // rings (outer + holes), closed
  | { type: 'MultiPolygon'; coordinates: Coordinate[][][] };
```

### `SpatialObject`

```typescript
interface SpatialObject {
  spatialId: string;                 // totem:spatial:<sha3-256-hex>
  kind: 'site-boundary' | 'zone' | 'route' | 'scene-footprint'
      | 'asset-footprint' | 'restricted-area' | 'inspection-area' | 'custom';
  geometry: GeoGeometry;
  crs?: 'EPSG:4326' | string;        // defaults to EPSG:4326
  name?: string;
  metadata?: Record<string, unknown>;
}
```

### `SpatialRelationClaim`

```typescript
interface SpatialRelationClaim {
  relationId: string;                // totem:spatial:<sha3-256-hex>
  subjectId: string;
  subjectKind: string;
  spatialObjectId: string;
  relation: 'inside' | 'outside' | 'intersects' | 'overlaps' | 'covers'
         | 'covered_by' | 'within_distance' | 'near_boundary' | 'on_route'
         | 'entered_zone' | 'exited_zone' | 'unknown';
  computedAt: number;                // ms since epoch
  engine: { name: string; version: string; algorithm: string };
  inputs: {
    subjectGeometryHash?: string;
    spatialGeometryHash: string;
    subjectProofId?: string;
    locationClaimId?: string;
    rasterManifestId?: string;
  };
  result: {
    matched: boolean;
    distanceM?: number;
    confidenceScore?: number;
    uncertainty?: string[];          // explicit notes where math is approximate
  };
  metadata?: Record<string, unknown>;
}
```

Stable IDs exclude only mutable fields: `relationId` and `metadata` for claims; `spatialId` and `metadata` for objects. `computedAt` and `result` are content — a re-evaluation at a different time is a new observation of a relationship.

## Usage example — point inside polygon → proof → sign → verify

```typescript
import {
  computeSpatialObjectId,
  evaluateSpatialRelation,
  createUnsignedSpatialProof,
  signSpatialProof,
  verifySpatialProof,
} from '@totemsdk/spatial-proof';

const site = {
  spatialId: computeSpatialObjectId({
    kind: 'site-boundary',
    name: 'ZEDD site A',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [36.80, -1.28], [36.82, -1.28], [36.82, -1.30], [36.80, -1.30], [36.80, -1.28],
      ]],
    },
  }),
  kind: 'site-boundary' as const,
  name: 'ZEDD site A',
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [36.80, -1.28], [36.82, -1.28], [36.82, -1.30], [36.80, -1.30], [36.80, -1.28],
    ]],
  },
};

// drone GPS fix: lon 36.81, lat -1.29 (GeoJSON [lon, lat] order)
const claim = evaluateSpatialRelation({
  subjectId: 'device:drone-007',
  subjectKind: 'device',
  spatialObject: site,
  relation: 'inside',
  subjectGeometry: { type: 'Point', coordinates: [36.81, -1.29] },
  computedAt: 1_700_000_000_000,
});

console.log(claim.result.matched);          // true
console.log(claim.result.uncertainty);      // ['Point-in-polygon test is planar (lon/lat); not a geodesic test.']

const unsigned = createUnsignedSpatialProof({ claim, spatialObject: site, issuedAt: 1_700_000_000_000 });
const signed = signSpatialProof(unsigned, seedBytes, 7); // reserve the WOTS key index first!

const result = verifySpatialProof(signed);
console.log(result.valid, result.relationId);
```

## Location-proof integration example

```typescript
import { createLocationClaim } from '@totemsdk/location-proof';
import { spatialRelationFromLocationClaim } from '@totemsdk/spatial-proof';

const locationClaim = createLocationClaim({
  subjectId: 'device:drone-007',
  deviceId: 'drone-007',
  observedAt: 1_700_000_000_000,
  location: { lat: -1.29, lon: 36.81, accuracyM: 2 },   // location-proof uses { lat, lon }
  source: { type: 'rtk', satellitesUsed: 16, hdop: 0.7 },
});

const relation = spatialRelationFromLocationClaim({
  locationClaim,
  spatialObject: site,
  relation: 'inside',
  computedAt: 1_700_000_000_000,
});

console.log(relation.result.matched);            // true
console.log(relation.inputs.locationClaimId);    // totem:location:…
```

## Proofgraph example

```typescript
import { createProofGraph, addEdge } from '@totemsdk/proofgraph';
import {
  spatialRelationToProofGraphNode,
  spatialRelationToGraphEdges,
} from '@totemsdk/spatial-proof';

let graph = createProofGraph();
const node = spatialRelationToProofGraphNode(claim);   // custom:<relationId>
for (const edge of spatialRelationToGraphEdges(claim)) {
  graph = addEdge(graph, edge);                         // about / references / derived_from
}
```

## Drone / ship / robot / vehicle examples

```typescript
// Drone flight covered a polygon
const covered = evaluateSpatialRelation({
  subjectId: 'device:drone-007',
  subjectKind: 'device',
  spatialObject: { ...site, kind: 'zone' },
  relation: 'covers',
  subjectGeometry: { type: 'Polygon', coordinates: [[...flightBbox]] }, // approx — bbox only
  computedAt: 1_700_000_000_000,
});
// covered.result.uncertainty includes the bounding-box note.

// Ship entered a maritime zone
const entered = evaluateSpatialRelation({
  subjectId: 'vessel:ms-heron',
  subjectKind: 'vessel',
  spatialObject: { ...site, kind: 'zone', name: 'EEZ maritime zone' },
  relation: 'entered_zone',
  subjectGeometry: { type: 'Point', coordinates: [40.0, 35.0] },
  computedAt: 1_700_000_000_000,
});

// Robot stayed inside a permitted work area
const stayed = evaluateSpatialRelation({
  subjectId: 'robot:arm-01',
  subjectKind: 'robot',
  spatialObject: { ...site, kind: 'restricted-area' },
  relation: 'inside',
  subjectGeometry: { type: 'Point', coordinates: [36.81, -1.29] },
  computedAt: 1_700_000_000_000,
});

// Vehicle followed an approved route (LineString, corridor tolerance)
const onRoute = evaluateSpatialRelation({
  subjectId: 'vehicle:bus-12',
  subjectKind: 'vehicle',
  spatialObject: { ...site, kind: 'route', geometry: approvedRouteLineString },
  relation: 'on_route',
  subjectGeometry: { type: 'Point', coordinates: [36.81, -1.29] },
  maxDistanceM: 50,
  computedAt: 1_700_000_000_000,
});
```

## Limitations

- `intersects` / `overlaps` / `covers` / `covered_by` are **bounding-box approximations** — never treated as exact polygon intersections or coverages. The claim always says so.
- Polygon "overlap" uses a vertex-probing heuristic when both sides are polygons; polygons that cross edges without shared vertices may be misjudged. Full polygon intersection is out of scope.
- All math is planar/equirectangular on WGS84 lon/lat. Suitable for geofences and local routes; not a geodetic engine.
- `MultiPolygon` holes are validated but the hole semantics of `pointInPolygon` are not applied (outer ring only).

## Security notes

- **WOTS one-time keys.** Each WOTS key index can be used exactly once. Never sign two different proofs with the same key index. Reserve indices through [`@totemsdk/wots-lease`](https://www.npmjs.com/package/@totemsdk/wots-lease) before signing.
- **Relations are not absolute truth.** A bbox-only relation is a deliberate approximation — trust it only where bbox precision is acceptable.
- **Input integrity.** The subject geometry is hashed into the claim. To verify that a claim's `result` matches its inputs, re-evaluate with the same subject geometry and compare `matched`.
- **Proof verification** recomputes the relation ID, evidence hashes, and WOTS signature; anchored records are optional and not required.

## Related packages

- [`@totemsdk/core`](https://www.npmjs.com/package/@totemsdk/core) — SHA3-256, WOTS signing, script derivation
- [`@totemsdk/proof`](https://www.npmjs.com/package/@totemsdk/proof) — proof envelopes, signing, verification
- [`@totemsdk/proofgraph`](https://www.npmjs.com/package/@totemsdk/proofgraph) — content-addressed proof relationship graph
- [`@totemsdk/location-proof`](https://www.npmjs.com/package/@totemsdk/location-proof) — device-neutral location claims and confidence scoring
- [`@totemsdk/identity`](https://www.npmjs.com/package/@totemsdk/identity) — device/agent identities
- [`@totemsdk/manifest`](https://www.npmjs.com/package/@totemsdk/manifest) — signed entity declarations
- [`@totemsdk/wots-lease`](https://www.npmjs.com/package/@totemsdk/wots-lease) — one-time key safety
- [`@totemsdk/edge`](https://www.npmjs.com/package/@totemsdk/edge) — unified edge runtime
