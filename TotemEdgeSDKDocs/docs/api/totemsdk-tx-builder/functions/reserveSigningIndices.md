[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / reserveSigningIndices

# Function: reserveSigningIndices()

> **reserveSigningIndices**(`lease`, `params`): `Promise`\<[`LeaseReservationLike`](../interfaces/LeaseReservationLike.md)\>

Reserve a WOTS leaf for a digest.

## Parameters

### lease

[`SigningLease`](../interfaces/SigningLease.md)

### params

#### branchId?

`string`

#### digestHex

`string`

#### purpose?

`string`

#### treeId

`string`

#### ttlMs?

`number`

## Returns

`Promise`\<[`LeaseReservationLike`](../interfaces/LeaseReservationLike.md)\>
