[**@totemsdk/location-proof**](../index.md)

***

[@totemsdk/location-proof](../index.md) / createLocationClaim

# Function: createLocationClaim()

> **createLocationClaim**(`input`): [`LocationClaim`](../interfaces/LocationClaim.md)

Create a LocationClaim with a content-derived claimId.
The claimId is computed from the stable fields (receivedAt, confidenceScore,
and metadata are excluded from the hash).

## Parameters

### input

`Omit`\<[`LocationClaim`](../interfaces/LocationClaim.md), `"claimId"`\>

## Returns

[`LocationClaim`](../interfaces/LocationClaim.md)
