[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / GovernanceBridge

# Interface: GovernanceBridge

## Methods

### abort()

> **abort**(`reservationId`, `error`): `Promise`\<`EdgeOperationResult`\<`void`\>\>

#### Parameters

##### reservationId

`string`

##### error

[`ActionError`](ActionError.md)

#### Returns

`Promise`\<`EdgeOperationResult`\<`void`\>\>

***

### commit()

> **commit**(`reservationId`, `execution`): `Promise`\<`EdgeOperationResult`\<`void`\>\>

#### Parameters

##### reservationId

`string`

##### execution

[`ActionExecution`](ActionExecution.md)

#### Returns

`Promise`\<`EdgeOperationResult`\<`void`\>\>

***

### reserve()

> **reserve**(`proposal`, `mandateProofId`): `Promise`\<`EdgeOperationResult`\<\{ `reservationId`: `string`; \}\>\>

#### Parameters

##### proposal

[`ActionProposal`](ActionProposal.md)

##### mandateProofId

`string`

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `reservationId`: `string`; \}\>\>
