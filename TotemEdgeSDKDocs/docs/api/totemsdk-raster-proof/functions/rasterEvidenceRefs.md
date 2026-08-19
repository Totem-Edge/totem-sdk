[**@totemsdk/raster-proof**](../index.md)

***

[@totemsdk/raster-proof](../index.md) / rasterEvidenceRefs

# Function: rasterEvidenceRefs()

> **rasterEvidenceRefs**(`manifest`, `windowProof?`, `spatialObjectId?`): `EvidenceRef`[]

Build the evidence ref list for a raster proof:
  - raster manifest hash
  - content hash
  - Merkle root when present
  - window proof hash when present
  - source raster IDs when derived
  - spatial object ID when present

## Parameters

### manifest

[`RasterManifest`](../interfaces/RasterManifest.md)

### windowProof?

[`RasterWindowProof`](../interfaces/RasterWindowProof.md)

### spatialObjectId?

`string`

## Returns

`EvidenceRef`[]
