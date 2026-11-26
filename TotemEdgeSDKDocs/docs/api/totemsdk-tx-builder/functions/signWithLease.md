[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / signWithLease

# Function: signWithLease()

> **signWithLease**(`params`): `Promise`\<\{ `reservation`: [`LeaseReservationLike`](../interfaces/LeaseReservationLike.md); `wotsData`: [`WotsSignatureData`](../interfaces/WotsSignatureData.md); \}\>

Convenience: reserve → sign with the supplied local WOTS callback → return
the reservation so the caller can commit it after broadcast.

## Parameters

### params

#### branchId?

`string`

#### digestHex

`string`

#### lease

[`SigningLease`](../interfaces/SigningLease.md)

#### sign

(`digestHex`, `indices`) => `Promise`\<[`WotsSignatureData`](../interfaces/WotsSignatureData.md)\>

#### treeId

`string`

## Returns

`Promise`\<\{ `reservation`: [`LeaseReservationLike`](../interfaces/LeaseReservationLike.md); `wotsData`: [`WotsSignatureData`](../interfaces/WotsSignatureData.md); \}\>
