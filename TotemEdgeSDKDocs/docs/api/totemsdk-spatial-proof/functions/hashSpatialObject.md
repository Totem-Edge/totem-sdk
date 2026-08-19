[**@totemsdk/spatial-proof**](../index.md)

***

[@totemsdk/spatial-proof](../index.md) / hashSpatialObject

# Function: hashSpatialObject()

> **hashSpatialObject**(`obj`): `string`

Hash a complete SpatialObject (excluding spatialId and metadata)
to lowercase SHA3-256 hex without a 0x prefix — the value used in
EvidenceRef.hash.

## Parameters

### obj

[`SpatialObject`](../interfaces/SpatialObject.md)

## Returns

`string`
