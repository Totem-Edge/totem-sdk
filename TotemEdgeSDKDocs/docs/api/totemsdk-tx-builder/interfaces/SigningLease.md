[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / SigningLease

# Interface: SigningLease

Structural subset of `@totemsdk/wots-lease`'s `WotsLeaseProvider`.

## Methods

### burnReservation()

> **burnReservation**(`reservationId`, `reason`): `Promise`\<`void`\>

#### Parameters

##### reservationId

`string`

##### reason

`string`

#### Returns

`Promise`\<`void`\>

***

### commitKeyUse()

> **commitKeyUse**(`reservationId`, `txId`): `Promise`\<`void`\>

#### Parameters

##### reservationId

`string`

##### txId

`string`

#### Returns

`Promise`\<`void`\>

***

### reserveKeyUse()

> **reserveKeyUse**(`params`): `Promise`\<[`LeaseReservationLike`](LeaseReservationLike.md)\>

#### Parameters

##### params

###### branchId?

`string`

###### deviceId?

`string`

###### payloadHash?

`string`

###### purpose?

`string`

###### treeId

`string`

###### ttlMs?

`number`

###### valueHint?

`string`

#### Returns

`Promise`\<[`LeaseReservationLike`](LeaseReservationLike.md)\>
