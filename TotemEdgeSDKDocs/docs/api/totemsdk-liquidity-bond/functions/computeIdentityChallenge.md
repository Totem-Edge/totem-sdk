[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / computeIdentityChallenge

# Function: computeIdentityChallenge()

> **computeIdentityChallenge**(`entityId`, `address`): `string`

Domain-separated challenge for an identity claim (#33): scoped to the entity
(poolId / positionId / receiptId) so a signature on one record cannot replay
against another.

## Parameters

### entityId

`string`

### address

`string`

## Returns

`string`
