[**@totemsdk/location-proof**](../index.md)

***

[@totemsdk/location-proof](../index.md) / hashLocationClaim

# Function: hashLocationClaim()

> **hashLocationClaim**(`claim`): `string`

Hash a complete LocationClaim (excluding claimId and mutable fields)
to lowercase SHA3-256 hex without a 0x prefix.

## Parameters

### claim

[`LocationClaim`](../interfaces/LocationClaim.md)

## Returns

`string`
