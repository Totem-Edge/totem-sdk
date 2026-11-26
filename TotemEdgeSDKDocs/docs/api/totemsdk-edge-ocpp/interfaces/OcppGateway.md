[**@totemsdk/edge-ocpp**](../index.md)

***

[@totemsdk/edge-ocpp](../index.md) / OcppGateway

# Interface: OcppGateway

## Properties

### status

> `readonly` **status**: `"stopped"` \| `"running"` \| `"error"`

## Methods

### authorize()

> **authorize**(`idTag`): `Promise`\<`EdgeOperationResult`\<\{ `payload`: `Record`\<`string`, `unknown`\>; \}\>\>

#### Parameters

##### idTag

`string`

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `payload`: `Record`\<`string`, `unknown`\>; \}\>\>

***

### call()

> **call**(`action`, `payload?`, `timeoutMs?`): `Promise`\<`EdgeOperationResult`\<\{ `payload`: `Record`\<`string`, `unknown`\>; \}\>\>

#### Parameters

##### action

`string`

##### payload?

`Record`\<`string`, `unknown`\>

##### timeoutMs?

`number`

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `payload`: `Record`\<`string`, `unknown`\>; \}\>\>

***

### onCall()

> **onCall**(`action`, `handler`): () => `void`

Register a handler for an inbound CSMS CALL.

#### Parameters

##### action

`string`

##### handler

[`OcppCallHandler`](../type-aliases/OcppCallHandler.md)

#### Returns

() => `void`

***

### sendBootNotification()

> **sendBootNotification**(`payload?`): `Promise`\<`EdgeOperationResult`\<\{ `payload`: `Record`\<`string`, `unknown`\>; \}\>\>

#### Parameters

##### payload?

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `payload`: `Record`\<`string`, `unknown`\>; \}\>\>

***

### sendHeartbeat()

> **sendHeartbeat**(): `Promise`\<`EdgeOperationResult`\<\{ `payload`: `Record`\<`string`, `unknown`\>; \}\>\>

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `payload`: `Record`\<`string`, `unknown`\>; \}\>\>

***

### sendStatusNotification()

> **sendStatusNotification**(`connectorId`, `status`, `errorCode?`): `Promise`\<`EdgeOperationResult`\<\{ `payload`: `Record`\<`string`, `unknown`\>; \}\>\>

#### Parameters

##### connectorId

`number`

##### status

`string`

##### errorCode?

`string`

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `payload`: `Record`\<`string`, `unknown`\>; \}\>\>

***

### start()

> **start**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### stop()

> **stop**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>
