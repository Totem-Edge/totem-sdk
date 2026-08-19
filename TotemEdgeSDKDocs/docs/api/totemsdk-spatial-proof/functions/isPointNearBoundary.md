[**@totemsdk/spatial-proof**](../index.md)

***

[@totemsdk/spatial-proof](../index.md) / isPointNearBoundary

# Function: isPointNearBoundary()

> **isPointNearBoundary**(`point`, `polygon`, `thresholdM`): `boolean`

True when a point is within `thresholdM` meters of any boundary ring of a
Polygon (outer ring and holes). Uses the equirectangular approximation.

## Parameters

### point

[`Coordinate`](../type-aliases/Coordinate.md)

### polygon

[`GeoPolygonGeometry`](../interfaces/GeoPolygonGeometry.md)

### thresholdM

`number`

## Returns

`boolean`
