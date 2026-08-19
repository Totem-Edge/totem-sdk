[**@totemsdk/raster-proof**](../index.md)

***

[@totemsdk/raster-proof](../index.md) / computeRasterManifestId

# Function: computeRasterManifestId()

> **computeRasterManifestId**(`input`): `string`

Compute the stable raster manifest ID: "totem:raster:<sha3-256-hex>".
Deterministic over stable fields — the same logical manifest always hashes
to the same identifier.

## Parameters

### input

`Omit`\<[`RasterManifest`](../interfaces/RasterManifest.md), `"rasterId"`\>

## Returns

`string`
