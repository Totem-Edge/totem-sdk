# @totemsdk/raster-proof

Edge-capable raster and visual evidence proof primitives for Totem Edge — asset hashes, tile Merkle roots, raster manifests, derived-layer provenance, and proof envelope integration.

No network. No storage. No GDAL. No GeoTIFF parsing. No ML. Pure hashing, manifest, provenance, and proof primitives that run safely on a drone, ship, robot, vehicle, site camera, field laptop, or edge gateway.

## Mission

`@totemsdk/raster-proof` lets drones, robots, ships, vehicles, site cameras, satellites, field laptops, and edge gateways create verifiable proof records for imagery and raster-like data:

- drone photos
- video segments
- satellite scene windows
- GeoTIFF / COG references
- map tiles
- orthomosaic outputs
- thermal images
- lidar-derived rasters
- robot camera frames
- ship radar snapshots
- flood masks
- vegetation masks
- change-detection masks
- construction progress images
- derived analysis layers

It is **not tied to any single project**. Satellite imagery is only one application.

### What this package does

```text
asset metadata
+ byte/content hash
+ optional chunk Merkle root
+ optional tile/window proof
+ spatial metadata
+ provenance
+ signed proof envelope
+ proofgraph linkage
```

### What this package does NOT do

```text
✗ GDAL
✗ full GeoTIFF parsing
✗ satellite provider APIs
✗ STAC search
✗ cloud masking
✗ NDVI calculation
✗ ML segmentation
✗ orthomosaic generation
✗ image tile server
✗ map renderer
✗ file-system storage
✗ network storage
```

Heavy processing belongs elsewhere. This package only hashes bytes and records the metadata that makes them verifiable.

## Important wording

> This package proves bytes, manifests, provenance, windows and declared relationships. It does **not** prove that a visual interpretation is correct unless a reviewer or downstream model proof says so.

A `RasterManifest` and its proof say: "these bytes, captured by this device/operator/mission, at this time, with this content hash / Merkle root, in this spatial context". They do not claim "this water mask is correct". Interpretation correctness is a separate, explicit claim.

## Edge-safe design

- **On a small device:** hash bytes, create manifests, sign capture records, verify Merkle proofs.
- **On a stronger edge node:** verify derived-layer provenance, evaluate spatial relations, build proof graphs.
- SHA3-256 only (from `@totemsdk/core`). No WASM gate, no Node crypto dependency, no heavy GIS imports. Deterministic everywhere — identical input always produces identical IDs, hashes, and proof IDs.

## Installation

```bash
npm install @totemsdk/raster-proof
```

## Package scope

- Byte / string hashing (`hashBytes`, `hashString`)
- Edge-safe Merkle chunking (default 64 KiB), root, inclusion proofs (domain-separated `totem-raster-leaf` / `totem-raster-node`)
- Deterministic raster manifests (`totem:raster:<sha3-256-hex>`) with asset, spatial, and provenance metadata
- Manifest validation with structured errors/warnings
- Window / tile proofs (`totem:raster-window:<sha3-256-hex>`)
- Derived-raster provenance (`createDerivedRasterManifest`, `verifyRasterDerivation`)
- `@totemsdk/proof` evidence refs, unsigned proof creation, WOTS signing, end-to-end verification
- `@totemsdk/spatial-proof` integration (raster footprint → spatial object, spatial relations)
- `@totemsdk/proofgraph` node/edge helpers

### Dependencies

Only what is imported: `@totemsdk/core` (SHA3-256), `@totemsdk/proof` (envelopes), `@totemsdk/proofgraph` (graph helpers), `@totemsdk/spatial-proof` (relations).

## Merkle chunking

- Default chunk size **64 KiB**; empty bytes are rejected; chunk size must be positive.
- Chunk content hash = SHA3-256 of the raw bytes. Merkle leaves and internal nodes are domain-separated, so a chunk hash can never be confused with a node hash.
- **Odd-layer rule (deterministic):** when a Merkle level has an odd number of hashes, the last hash is **promoted** unchanged to the next level (it is NOT duplicated or hashed with itself).
- All hashes are lowercase hex without `0x`.

```typescript
import { chunkBytes, computeMerkleRoot, createRasterMerkleSummary } from '@totemsdk/raster-proof';

const bytes = new TextEncoder().encode('drone photo bytes…');

const summary = createRasterMerkleSummary(bytes, { chunkSizeBytes: 64 * 1024 });
// { contentHash, merkleRoot, chunkSizeBytes, chunkCount, byteSize }
```

## IDs and hashing

| ID / hash | Shape | Stable fields exclude |
|-----------|-------|----------------------|
| `rasterId` | `totem:raster:<sha3-256-hex>` | `rasterId`, `metadata` |
| `windowProofId` | `totem:raster-window:<sha3-256-hex>` | `windowProofId`, `metadata` |

## API table

### Hashing

| Export | Description |
|--------|-------------|
| `hashBytes(bytes)` | SHA3-256 of raw bytes → lowercase hex |
| `hashString(value)` | SHA3-256 of a UTF-8 string → lowercase hex |
| `hashSubarray(bytes, offset, length)` | Hash a byte window in place |

### Merkle

| Export | Description |
|--------|-------------|
| `DEFAULT_CHUNK_SIZE_BYTES` | 64 KiB |
| `chunkBytes(bytes, chunkSizeBytes?)` | Split into content-hashed chunks |
| `merkleLeafHash(chunk)` | Domain-separated leaf hash of a chunk |
| `computeMerkleRoot(chunks)` | Deterministic root (promote odd last hash) |
| `createMerkleProof(chunks, leafIndex)` | Inclusion proof with siblings |
| `verifyMerkleProof(proof)` | Recompute root from leaf + siblings |
| `createRasterMerkleSummary(bytes, options?)` | Hash + chunk + root in one pass |

### Manifests

| Export | Description |
|--------|-------------|
| `createRasterManifest(params)` | Deterministic manifest with computed `rasterId` |
| `validateRasterManifest(manifest)` | Structured validation (errors + warnings) |
| `rasterManifestToEvidenceRef(manifest)` | Manifest → `EvidenceRef` |

### Derived provenance

| Export | Description |
|--------|-------------|
| `createDerivedRasterManifest(params)` | Derived manifest from source rasters |
| `verifyRasterDerivation(manifest, sources)` | Check declared provenance structure |

### Window proofs

| Export | Description |
|--------|-------------|
| `createRasterWindowProof(params)` | Deterministic window proof |
| `rasterWindowProofToEvidenceRef(proof)` | Window proof → `EvidenceRef` |

### Spatial-proof integration

| Export | Description |
|--------|-------------|
| `rasterFootprintToSpatialObject(manifest)` | Bounds → `SpatialObject`, or `null` with no bounds |
| `createRasterSpatialRelation(params)` | Raster footprint vs spatial object relation claim |

### Proof integration

| Export | Description |
|--------|-------------|
| `rasterEvidenceRefs(manifest, windowProof?, spatialObjectId?)` | Full evidence list for a raster proof |
| `createUnsignedRasterProof(params)` | Build an unsigned `attestation` proof |
| `signRasterProof(unsigned, seed, keyIndex)` | WOTS-sign the proof |
| `verifyRasterProof(signed)` | End-to-end verification with structured reasons |

### Proofgraph integration

| Export | Description |
|--------|-------------|
| `rasterManifestToProofGraphNode(manifest)` | Manifest → `custom` node |
| `rasterWindowProofToProofGraphNode(proof)` | Window proof → `custom` node |
| `rasterManifestToGraphEdges(manifest)` | `derived_from` / `references` / `about` edges |
| `rasterWindowProofToGraphEdges(proof)` | Window proof `derived_from` raster edge |
| `addRasterManifestToGraph(graph, manifest)` | Immutably add a manifest node |

## Drone example

```typescript
import {
  createRasterMerkleSummary,
  createRasterManifest,
  createUnsignedRasterProof,
  signRasterProof,
  verifyRasterProof,
} from '@totemsdk/raster-proof';

const photoBytes = new TextEncoder().encode('JPEG bytes…');
const summary = createRasterMerkleSummary(photoBytes);

const manifest = createRasterManifest({
  sourceType: 'drone',
  layerType: 'rgb',
  capturedAt: 1_712_000_000_000,
  deviceId: 'drone-007',
  missionId: 'mission-42',
  asset: {
    uri: 'https://cdn.example/flights/drone-007/ortho-001.tif',
    mediaType: 'image/tiff',
    format: 'geotiff',
    byteSize: photoBytes.length,
    contentHash: summary.contentHash,
    hashAlgorithm: 'sha3-256',
    merkleRoot: summary.merkleRoot,
    chunkSizeBytes: summary.chunkSizeBytes,
  },
  spatial: {
    crs: 'EPSG:4326',
    bounds: [36.78, -1.29, 36.82, -1.25], // minLon, minLat, maxLon, maxLat
    widthPx: 8192,
    heightPx: 6144,
    resolutionM: 0.05,
  },
});

const unsigned = createUnsignedRasterProof({ manifest, issuer: 'drone-007', issuedAt: 1_712_000_000_000 });
const signed = signRasterProof(unsigned, seedBytes, 9); // reserve the WOTS key index first!

const result = verifyRasterProof(signed);
console.log(result.valid, result.rasterId);
```

## Satellite scene window example

```typescript
import { chunkBytes, createMerkleProof, createRasterWindowProof } from '@totemsdk/raster-proof';

// A strong node chunks the full scene; a small device only needs its window.
const chunks = chunkBytes(sceneBytes, 64 * 1024);
const windowProof = createRasterWindowProof({
  rasterId: manifest.rasterId,
  merkleRoot: manifest.asset.merkleRoot!,
  chunkIndices: [12, 13, 14],
  chunkHashes: [chunks[12].hash, chunks[13].hash, chunks[14].hash],
  spatial: { bounds: [36.79, -1.28, 36.80, -1.27] },
});

// Optional: carry the full leaf proofs so a verifier can recompute the root
// from the window's own bytes.
createUnsignedRasterProof({
  manifest,
  windowProof,
  merkleProofs: [13].map((i) => createMerkleProof(chunks, i)),
  issuedAt,
});
```

## Derived water-mask / change-mask example

```typescript
import { createDerivedRasterManifest, verifyRasterDerivation } from '@totemsdk/raster-proof';

const waterMask = createDerivedRasterManifest({
  sourceManifests: [sceneManifest],           // satellite scene → water mask
  layerType: 'water-mask',
  asset: maskAsset,
  pipelineId: 'flood-watermask-v2',
  parametersHash: 'sha3-256:ab12…',          // required when pipelineId is set
  uncertainty: ['Model output; manual review recommended near edges.'],
  spatial: sceneManifest.spatial,
});

const result = verifyRasterDerivation(waterMask, [sceneManifest]);
if (!result.valid) {
  console.log(result.reasons);                // e.g. missing source rasters
}
console.log(result.uncertainty);              // uncertainty is preserved
```

`verifyRasterDerivation` only verifies the **declared** provenance structure — that every `derivedFrom` ID is supplied, parameters are present when a pipeline is named, and the manifest is honestly marked `sourceType: 'derived'`. It does not verify that image processing was correct.

## Manifest validation

`validateRasterManifest` checks:

- `sourceType`, `layerType`, `asset.format`, `asset.contentHash` required
- `asset.hashAlgorithm` must be `sha3-256`
- `createdAt` positive; `byteSize` non-negative
- `capturedAt` far after `createdAt` is rejected unless `metadata.allowFutureCapture === true`
- `spatial.bounds` in `[minLon, minLat, maxLon, maxLat]` GeoJSON order with valid ranges/ordering
- `widthPx` / `heightPx` positive integers, `resolutionM` positive
- derived rasters without `provenance.derivedFrom` produce a warning

## Proof verification

`verifyRasterProof` checks, in order:

1. underlying `@totemsdk/proof` verification (signature, `proofId`, expiry)
2. payload contains a structurally valid `RasterManifest`
3. `rasterId` recomputes from stable fields
4. manifest evidence hash matches the payload manifest
5. content hash and Merkle root evidence refs present when declared
6. window proof (when supplied): `windowProofId` recomputes, root matches the manifest's root, and any supplied Merkle proofs verify and reference referenced leaves
7. derivation structure valid for `sourceType: 'derived'`

Anchoring is not required. Source rasters are not embedded in the proof, so derivation is checked structurally inside the envelope; full cross-source verification is `verifyRasterDerivation`.

## Spatial-proof integration example

```typescript
import { computeSpatialObjectId } from '@totemsdk/spatial-proof';
import { rasterFootprintToSpatialObject, createRasterSpatialRelation } from '@totemsdk/raster-proof';

const site = {
  spatialId: computeSpatialObjectId({
    kind: 'site-boundary',
    name: 'Flood site A',
    geometry: { type: 'Polygon', coordinates: [[[36.78, -1.29], [36.82, -1.29], [36.82, -1.25], [36.78, -1.25], [36.78, -1.29]]] },
  }),
  kind: 'site-boundary' as const,
  name: 'Flood site A',
  geometry: { type: 'Polygon', coordinates: [[[36.78, -1.29], [36.82, -1.29], [36.82, -1.25], [36.78, -1.25], [36.78, -1.29]]] },
};

const footprint = rasterFootprintToSpatialObject(manifest); // null when manifest has no bounds
const claim = createRasterSpatialRelation({
  manifest,
  spatialObject: site,
  relation: 'covers',        // raster scene footprint covers the site boundary
});
console.log(claim.result.matched);                 // true (bbox cover)
console.log(claim.inputs.rasterManifestId);        // totem:raster:…
```

Geometry math, bbox relations, and uncertainty notes are delegated to `@totemsdk/spatial-proof` — nothing here is reimplemented. `covers`/`covered_by`/`intersects`/`overlaps` are bounding-box approximations there and always carry an explicit `uncertainty` note.

## Proofgraph example

```typescript
import { createProofGraph, addEdge } from '@totemsdk/proofgraph';
import { rasterManifestToProofGraphNode, rasterManifestToGraphEdges } from '@totemsdk/raster-proof';

let graph = createProofGraph();
graph = addEdge(graph, rasterManifestToGraphEdges(manifest)[0]);
// custom:<rasterId> node via rasterManifestToProofGraphNode + addNode
```

Edges represent:

- raster `derived_from` source rasters (when derived)
- raster `references` its spatial object (when present)
- raster `about` its device / operator / mission (when present)

The "raster supports proof" edge is created by `@totemsdk/proofgraph`'s `addProof` when the signed proof is added to the graph.

## Limitations

- **Not a raster engine.** No rendering, decoding, projection, or format parsing. Sizes and formats are declared, not verified.
- **Interpretation is not proven.** A proof binds bytes and metadata; it does not validate a water mask, NDVI value, or defect label. That requires an explicit reviewer/model claim.
- **Spatial relations are spatial-proof relations.** `covers`/`intersects`/`overlaps`/`covered_by` are bounding-box approximations there, always flagged with `uncertainty`.
- **Merkle odd-layers promote the last hash** — documented, deterministic, but different from duplication-based trees.
- **Window proofs carry chunk hashes, not sibling paths.** Full leaf-level re-derivation requires the optional Merkle proofs.
- **Source rasters are not embedded in proofs** — cross-source derivation verification needs the source manifests supplied separately.

## Security notes

- **WOTS one-time keys.** Each WOTS key index can be used exactly once. Never sign two different proofs with the same key index. Reserve indices through [`@totemsdk/wots-lease`](https://www.npmjs.com/package/@totemsdk/wots-lease) before signing.
- **Content hash binding.** `rasterId` and the evidence hash are derived from stable fields including the content hash — mutating `asset.contentHash`, `layerType`, `sourceType`, or `spatial.bounds` invalidates the ID and the proof.
- **Provenance is declared, not trusted.** `verifyRasterDerivation` checks structure, not the truthfulness of `derivedFrom` claims. Verify source manifests themselves before trusting a chain.
- **CRS / bounds are metadata.** Wrong CRS or wrong bounds are detected only by comparing against trusted ground truth.

## Related packages

- [`@totemsdk/core`](https://www.npmjs.com/package/@totemsdk/core) — SHA3-256, WOTS signing, script derivation
- [`@totemsdk/proof`](https://www.npmjs.com/package/@totemsdk/proof) — proof envelopes, signing, verification
- [`@totemsdk/proofgraph`](https://www.npmjs.com/package/@totemsdk/proofgraph) — content-addressed proof relationship graph
- [`@totemsdk/location-proof`](https://www.npmjs.com/package/@totemsdk/location-proof) — device-neutral location claims and confidence scoring
- [`@totemsdk/spatial-proof`](https://www.npmjs.com/package/@totemsdk/spatial-proof) — geospatial relation proofs (geofences, routes, coverage)
- [`@totemsdk/identity`](https://www.npmjs.com/package/@totemsdk/identity) — device/agent identities
- [`@totemsdk/manifest`](https://www.npmjs.com/package/@totemsdk/manifest) — signed entity declarations
- [`@totemsdk/wots-lease`](https://www.npmjs.com/package/@totemsdk/wots-lease) — one-time key safety
- [`@totemsdk/edge`](https://www.npmjs.com/package/@totemsdk/edge) — unified edge runtime