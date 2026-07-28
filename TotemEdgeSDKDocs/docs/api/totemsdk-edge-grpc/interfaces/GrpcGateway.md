[**@totemsdk/edge-grpc**](../index.md)

***

[@totemsdk/edge-grpc](../index.md) / GrpcGateway

# Interface: GrpcGateway

## Properties

### status

> `readonly` **status**: `"stopped"` \| `"running"` \| `"error"`

## Methods

### call()

> **call**(`path`, `payload`, `timeoutMs?`): `Promise`\<`EdgeOperationResult`\<\{ `payload`: `Uint8Array`; \}\>\>

Send a unary gRPC request and await the response.

#### Parameters

##### path

`string`

##### payload

`Uint8Array`

##### timeoutMs?

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
