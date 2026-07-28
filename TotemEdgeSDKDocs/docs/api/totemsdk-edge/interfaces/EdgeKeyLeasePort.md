[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / EdgeKeyLeasePort

# Interface: EdgeKeyLeasePort

Port for WOTS key-lease coordination.

Implementations must ensure that a WOTS key index is reserved exclusively
before any signing operation consumes it. This prevents double-spend of a
one-time WOTS key slot in concurrent or distributed environments.

Wire this port to @totemsdk/wots-lease's LocalLeaseProvider or any
distributed provider in the lease chain.

## Methods

### burn()

> **burn**(`reservationId`): `Promise`\<`void`\>

Burn the reservation without using the key (on error or cancellation).

#### Parameters

##### reservationId

`string`

#### Returns

`Promise`\<`void`\>

***

### commit()

> **commit**(`reservationId`): `Promise`\<`void`\>

Commit the reservation — the key has been used successfully.

#### Parameters

##### reservationId

`string`

#### Returns

`Promise`\<`void`\>

***

### reserve()

> **reserve**(`keyIndex`): `Promise`\<\{ `reservationId`: `string`; \}\>

Reserve a key index for signing. Returns a reservation token.

#### Parameters

##### keyIndex

`number`

#### Returns

`Promise`\<\{ `reservationId`: `string`; \}\>
