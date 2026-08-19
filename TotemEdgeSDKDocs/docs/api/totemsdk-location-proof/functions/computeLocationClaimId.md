[**@totemsdk/location-proof**](../index.md)

***

[@totemsdk/location-proof](../index.md) / computeLocationClaimId

# Function: computeLocationClaimId()

> **computeLocationClaimId**(`input`): `string`

Compute a stable URI-style claim ID: "totem:location:<sha3-256-hex>".
Callers pass the claim minus claimId; mutable fields are excluded internally.

## Parameters

### input

`Omit`\<[`LocationClaim`](../interfaces/LocationClaim.md), `"claimId"`\>

## Returns

`string`
