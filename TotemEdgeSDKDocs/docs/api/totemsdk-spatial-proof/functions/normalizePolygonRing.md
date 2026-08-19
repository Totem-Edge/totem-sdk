[**@totemsdk/spatial-proof**](../index.md)

***

[@totemsdk/spatial-proof](../index.md) / normalizePolygonRing

# Function: normalizePolygonRing()

> **normalizePolygonRing**(`ring`): [`Coordinate`](../type-aliases/Coordinate.md)[]

Deterministic normalizer: if the ring is not closed, append a copy of the
first point. Idempotent for already-closed rings. The returned array is a
fresh copy — the input is never mutated.

## Parameters

### ring

[`Coordinate`](../type-aliases/Coordinate.md)[]

## Returns

[`Coordinate`](../type-aliases/Coordinate.md)[]
