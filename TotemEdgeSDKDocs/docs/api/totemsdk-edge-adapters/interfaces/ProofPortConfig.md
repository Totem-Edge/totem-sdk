[**@totemsdk/edge-adapters**](../index.md)

***

[@totemsdk/edge-adapters](../index.md) / ProofPortConfig

# Interface: ProofPortConfig

## Properties

### defaultKind?

> `optional` **defaultKind?**: `any`

Default proof kind when callers don't specify one via context.

***

### issuer

> **issuer**: `string`

Issuer address or identifier stamped onto created proofs.

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

### provider

> **provider**: `ProofProvider`

***

### seed?

> `optional` **seed?**: `Uint8Array`\<`ArrayBufferLike`\>

32-byte WOTS seed. Required for signing; without it only unsigned
proofs are returned, which MUST NOT be presented as completed proofs.
