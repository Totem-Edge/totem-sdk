[**@totemsdk/spatial-proof**](../index.md)

***

[@totemsdk/spatial-proof](../index.md) / distancePointToSegmentMeters

# Function: distancePointToSegmentMeters()

> **distancePointToSegmentMeters**(`point`, `a`, `b`): `number`

Perpendicular distance from a point to a line segment defined by [a, b].
Uses an equirectangular local approximation scaled to meters — accurate for
short segments, approximate over large distances or near the poles.

## Parameters

### point

[`Coordinate`](../type-aliases/Coordinate.md)

### a

[`Coordinate`](../type-aliases/Coordinate.md)

### b

[`Coordinate`](../type-aliases/Coordinate.md)

## Returns

`number`
