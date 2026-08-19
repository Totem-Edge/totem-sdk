[**@totemsdk/raster-proof**](../index.md)

***

[@totemsdk/raster-proof](../index.md) / hashRasterManifest

# Function: hashRasterManifest()

> **hashRasterManifest**(`manifest`): `string`

Hash a complete RasterManifest (excluding rasterId and metadata) to
lowercase SHA3-256 hex without a 0x prefix — the value used in
EvidenceRef.hash.

## Parameters

### manifest

[`RasterManifest`](../interfaces/RasterManifest.md)

## Returns

`string`
