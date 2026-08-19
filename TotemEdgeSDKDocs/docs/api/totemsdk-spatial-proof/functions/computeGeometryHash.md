[**@totemsdk/spatial-proof**](../index.md)

***

[@totemsdk/spatial-proof](../index.md) / computeGeometryHash

# Function: computeGeometryHash()

> **computeGeometryHash**(`geometry`): `string`

Compute the stable geometry identifier: "totem:geo:<sha3-256-hex>".
Deterministic over the exact geometry — the same geometry always hashes
to the same identifier.

## Parameters

### geometry

[`GeoGeometry`](../type-aliases/GeoGeometry.md)

## Returns

`string`
