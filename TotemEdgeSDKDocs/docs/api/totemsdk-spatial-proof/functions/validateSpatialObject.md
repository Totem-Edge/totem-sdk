[**@totemsdk/spatial-proof**](../index.md)

***

[@totemsdk/spatial-proof](../index.md) / validateSpatialObject

# Function: validateSpatialObject()

> **validateSpatialObject**(`obj`): [`SpatialValidationResult`](../interfaces/SpatialValidationResult.md)

Validate a spatial object. CRS defaults to EPSG:4326; any other CRS
produces a warning (all geometry math here assumes WGS84 lon/lat).

## Parameters

### obj

[`SpatialObject`](../interfaces/SpatialObject.md)

## Returns

[`SpatialValidationResult`](../interfaces/SpatialValidationResult.md)
