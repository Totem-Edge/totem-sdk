[**@totemsdk/edge-adapters**](../index.md)

***

[@totemsdk/edge-adapters](../index.md) / LocationPortConfig

# Interface: LocationPortConfig

## Properties

### issuer?

> `optional` **issuer?**: `string`

Default issuer stamped onto created location proofs. When unset, the
claim's subjectId is used.

***

### keyIndex?

> `optional` **keyIndex?**: `number`

TreeKey index for direct signing (used when no leaseProvider is given).
Ignored when leaseProvider is set.

***

### leaseProvider?

> `optional` **leaseProvider?**: `object`

WOTS lease provider for coordinated key-index reservation.
When set, keyIndex is ignored and the index is reserved via the provider.

#### burnReservation()

> **burnReservation**(`reservationId`, `reason`): `Promise`\<`void`\>

##### Parameters

###### reservationId

`string`

###### reason

`string`

##### Returns

`Promise`\<`void`\>

#### commitKeyUse()

> **commitKeyUse**(`reservationId`, `txId`): `Promise`\<`void`\>

##### Parameters

###### reservationId

`string`

###### txId

`string`

##### Returns

`Promise`\<`void`\>

#### reserveKeyUse()

> **reserveKeyUse**(`params`): `Promise`\<\{ `indices`: \{ `addressIndex`: `number`; `l1`: `number`; `l2`: `number`; \}; `reservationId`: `string`; \}\>

##### Parameters

###### params

###### payloadHash?

`string`

###### treeId

`string`

###### ttlMs?

`number`

##### Returns

`Promise`\<\{ `indices`: \{ `addressIndex`: `number`; `l1`: `number`; `l2`: `number`; \}; `reservationId`: `string`; \}\>

***

### leaseTreeId?

> `optional` **leaseTreeId?**: `string`

***

### seed?

> `optional` **seed?**: `Uint8Array`\<`ArrayBufferLike`\>

32-byte WOTS seed. Required for signing; without it only unsigned
location proofs are returned, which MUST NOT be presented as completed
proofs.
