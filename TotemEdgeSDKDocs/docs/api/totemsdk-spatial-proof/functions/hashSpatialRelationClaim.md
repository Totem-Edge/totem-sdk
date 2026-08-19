[**@totemsdk/spatial-proof**](../index.md)

***

[@totemsdk/spatial-proof](../index.md) / hashSpatialRelationClaim

# Function: hashSpatialRelationClaim()

> **hashSpatialRelationClaim**(`claim`): `string`

Hash a complete SpatialRelationClaim (excluding relationId and metadata)
to lowercase SHA3-256 hex without a 0x prefix — the value used in
EvidenceRef.hash.

## Parameters

### claim

[`SpatialRelationClaim`](../interfaces/SpatialRelationClaim.md)

## Returns

`string`
