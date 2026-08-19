[**@totemsdk/spatial-proof**](../index.md)

***

[@totemsdk/spatial-proof](../index.md) / computeSpatialObjectId

# Function: computeSpatialObjectId()

> **computeSpatialObjectId**(`input`): `string`

Compute a stable URI-style spatial object ID: "totem:spatial:<sha3-256-hex>".
Callers pass the object minus spatialId; metadata is excluded internally.

## Parameters

### input

`Omit`\<[`SpatialObject`](../interfaces/SpatialObject.md), `"spatialId"`\>

## Returns

`string`
