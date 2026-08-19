[**@totemsdk/spatial-proof**](../index.md)

***

[@totemsdk/spatial-proof](../index.md) / computeSpatialRelationId

# Function: computeSpatialRelationId()

> **computeSpatialRelationId**(`input`): `string`

Compute a stable URI-style spatial relation claim ID using the same
"totem:spatial:" namespace as spatial objects. Relation and object hashes
are distinguishable by their content-derived preimage, so the shared prefix
cannot cause an ID collision for equivalent logical content.

## Parameters

### input

`Omit`\<[`SpatialRelationClaim`](../interfaces/SpatialRelationClaim.md), `"relationId"`\>

## Returns

`string`
