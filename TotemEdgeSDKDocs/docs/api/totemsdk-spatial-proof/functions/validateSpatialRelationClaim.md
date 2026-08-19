[**@totemsdk/spatial-proof**](../index.md)

***

[@totemsdk/spatial-proof](../index.md) / validateSpatialRelationClaim

# Function: validateSpatialRelationClaim()

> **validateSpatialRelationClaim**(`claim`): `object`

Validate the structure of a spatial relation claim (does not re-evaluate the
geometry — verification of the proof envelope also checks the claim ID and
evidence hashes).

## Parameters

### claim

[`SpatialRelationClaim`](../interfaces/SpatialRelationClaim.md)

## Returns

`object`

### errors

> **errors**: `string`[]

### valid

> **valid**: `boolean`

### warnings

> **warnings**: `string`[]
