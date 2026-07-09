[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / StatechainLeaseOps

# Interface: StatechainLeaseOps

## Methods

### burnReservation()

> **burnReservation**(`reservationId`): `Promise`\<`void`\>

#### Parameters

##### reservationId

`string`

#### Returns

`Promise`\<`void`\>

***

### commitKeyUse()

> **commitKeyUse**(`reservationId`): `Promise`\<`void`\>

#### Parameters

##### reservationId

`string`

#### Returns

`Promise`\<`void`\>

***

### reserveKeyUse()

> **reserveKeyUse**(`keyIndex`): `Promise`\<\{ `reservationId`: `string`; \}\>

#### Parameters

##### keyIndex

`number`

#### Returns

`Promise`\<\{ `reservationId`: `string`; \}\>
