[**@totemsdk/location-proof**](../index.md)

***

[@totemsdk/location-proof](../index.md) / computeMovementTrailId

# Function: computeMovementTrailId()

> **computeMovementTrailId**(`input`): `string`

Compute a stable URI-style movement trail ID: "totem:movement:<sha3-256-hex>".
Derived fields (maxComputedSpeedMps, impossibleJumpDetected) and metadata
are excluded so the ID depends only on the trail content.

## Parameters

### input

`Omit`\<[`MovementTrail`](../interfaces/MovementTrail.md), `"trailId"`\>

## Returns

`string`
