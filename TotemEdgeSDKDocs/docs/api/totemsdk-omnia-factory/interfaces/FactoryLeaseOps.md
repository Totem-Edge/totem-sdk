[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / FactoryLeaseOps

# Interface: FactoryLeaseOps

Minimal lease operations required by the factory signing cycle.

This is a structural subset of `WotsLeaseProvider` from `@totemsdk/wots-lease`.
Any real `WotsLeaseProvider` satisfies this interface.  In tests, only these
three methods need to be mocked — no other watermark or sync methods required.

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

> **reserveKeyUse**(`params`): `Promise`\<\{ `expiresAt`: `number`; `indices`: `SigningIndices`; `reservationId`: `string`; \}\>

#### Parameters

##### params

###### payloadHash?

`string`

###### purpose?

`string`

###### treeId

`string`

###### ttlMs?

`number`

#### Returns

`Promise`\<\{ `expiresAt`: `number`; `indices`: `SigningIndices`; `reservationId`: `string`; \}\>
