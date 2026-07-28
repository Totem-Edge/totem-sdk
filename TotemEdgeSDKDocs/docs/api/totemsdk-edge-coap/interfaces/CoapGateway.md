[**@totemsdk/edge-coap**](../index.md)

***

[@totemsdk/edge-coap](../index.md) / CoapGateway

# Interface: CoapGateway

## Properties

### status

> `readonly` **status**: `"stopped"` \| `"running"` \| `"error"`

## Methods

### get()

> **get**(`path`, `host`, `port`): `Promise`\<`EdgeOperationResult`\<\{ `payload`: `Uint8Array`; \}\>\>

#### Parameters

##### path

`string`[]

##### host

`string`

##### port

`number`

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `payload`: `Uint8Array`; \}\>\>

***

### post()

> **post**(`path`, `payload`, `host`, `port`): `Promise`\<`EdgeOperationResult`\<\{ `payload`: `Uint8Array`; \}\>\>

#### Parameters

##### path

`string`[]

##### payload

`Uint8Array`

##### host

`string`

##### port

`number`

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `payload`: `Uint8Array`; \}\>\>

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
