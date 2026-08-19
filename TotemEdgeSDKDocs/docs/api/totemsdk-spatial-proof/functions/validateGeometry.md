[**@totemsdk/spatial-proof**](../index.md)

***

[@totemsdk/spatial-proof](../index.md) / validateGeometry

# Function: validateGeometry()

> **validateGeometry**(`geometry`): [`SpatialValidationResult`](../interfaces/SpatialValidationResult.md)

Validate a single geometry.

Rules:
  - Point: 1 valid coordinate
  - LineString: at least 2 valid coordinates
  - Polygon: at least 4 points per ring; rings must be closed
  - MultiPolygon: at least 1 polygon, each valid

## Parameters

### geometry

[`GeoGeometry`](../type-aliases/GeoGeometry.md)

## Returns

[`SpatialValidationResult`](../interfaces/SpatialValidationResult.md)
