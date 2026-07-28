[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / PolicySignerConfig

# Interface: PolicySignerConfig

## Properties

### address

> **address**: `string`

***

### publicKeyHex

> **publicKeyHex**: `string`

***

### signFn

> **signFn**: (`data`, `keyIndex`) => `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

#### Parameters

##### data

`Uint8Array`

##### keyIndex

`number`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

***

### treeId

> **treeId**: `string`

***

### wotsLeaseProvider?

> `optional` **wotsLeaseProvider?**: `object`

#### burnReservation()

> **burnReservation**(`reservationId`, `reason`): `Promise`\<`void`\>

##### Parameters

###### reservationId

`string`

###### reason

`string`

##### Returns

`Promise`\<`void`\>

#### commitReservation()

> **commitReservation**(`reservationId`, `txId`): `Promise`\<`void`\>

##### Parameters

###### reservationId

`string`

###### txId

`string`

##### Returns

`Promise`\<`void`\>

#### reserveKeyUse()

> **reserveKeyUse**(`params`): `Promise`\<\{ `indices`: \{ `l1`: `number`; `l2`: `number`; `l3`: `number`; \}; `publicKey`: `string`; `reservationId`: `string`; \}\>

##### Parameters

###### params

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

##### Returns

`Promise`\<\{ `indices`: \{ `l1`: `number`; `l2`: `number`; `l3`: `number`; \}; `publicKey`: `string`; `reservationId`: `string`; \}\>
