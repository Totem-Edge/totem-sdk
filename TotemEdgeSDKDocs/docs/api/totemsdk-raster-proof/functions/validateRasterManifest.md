[**@totemsdk/raster-proof**](../index.md)

***

[@totemsdk/raster-proof](../index.md) / validateRasterManifest

# Function: validateRasterManifest()

> **validateRasterManifest**(`manifest`): [`RasterValidationResult`](../interfaces/RasterValidationResult.md)

Validate the structure of a RasterManifest. Structural only — does not
re-hash bytes (verification of a proof envelope also recomputes the ID and
manifest hash).

## Parameters

### manifest

[`RasterManifest`](../interfaces/RasterManifest.md)

## Returns

[`RasterValidationResult`](../interfaces/RasterValidationResult.md)
