[**@totemsdk/spatial-proof**](../index.md)

***

[@totemsdk/spatial-proof](../index.md) / pointInPolygon

# Function: pointInPolygon()

> **pointInPolygon**(`point`, `polygon`): `boolean`

Ray-casting point-in-polygon test over the outer ring of a Polygon.
Uses a normalized (closed) copy of the ring. Approximate on the lon/lat
plane — fine for typical geofences; not geodesic.

## Parameters

### point

[`Coordinate`](../type-aliases/Coordinate.md)

### polygon

[`GeoPolygonGeometry`](../interfaces/GeoPolygonGeometry.md)

## Returns

`boolean`
