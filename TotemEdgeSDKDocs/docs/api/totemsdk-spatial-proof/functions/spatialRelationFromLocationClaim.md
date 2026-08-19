[**@totemsdk/spatial-proof**](../index.md)

***

[@totemsdk/spatial-proof](../index.md) / spatialRelationFromLocationClaim

# Function: spatialRelationFromLocationClaim()

> **spatialRelationFromLocationClaim**(`params`): [`SpatialRelationClaim`](../interfaces/SpatialRelationClaim.md)

Derive a spatial relation claim from a location claim.

The location claim's [lon, lat] is used as the subject Point geometry and
its claimId is recorded as the locationClaimId input, so the resulting
spatial claim provably references the location claim it was computed from.

## Parameters

### params

#### computedAt?

`number`

#### locationClaim

`LocationClaim`

#### maxDistanceM?

`number`

#### metadata?

`Record`\<`string`, `unknown`\>

#### relation

[`SpatialRelationType`](../type-aliases/SpatialRelationType.md)

#### spatialObject

[`SpatialObject`](../interfaces/SpatialObject.md)

## Returns

[`SpatialRelationClaim`](../interfaces/SpatialRelationClaim.md)
