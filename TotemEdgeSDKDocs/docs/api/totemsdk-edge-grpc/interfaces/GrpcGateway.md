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

### openBidiStream()

> **openBidiStream**(`path`, `timeoutMs?`): `Promise`\<`EdgeOperationResult`\<[`GrpcStreamHandle`](GrpcStreamHandle.md)\>\>

#### Parameters

##### path

`string`

##### timeoutMs?

`number`

#### Returns

`Promise`\<`EdgeOperationResult`\<[`GrpcStreamHandle`](GrpcStreamHandle.md)\>\>

***

### openClientStream()

> **openClientStream**(`path`, `timeoutMs?`): `Promise`\<`EdgeOperationResult`\<[`GrpcStreamHandle`](GrpcStreamHandle.md)\>\>

#### Parameters

##### path

`string`

##### timeoutMs?

`number`

#### Returns

`Promise`\<`EdgeOperationResult`\<[`GrpcStreamHandle`](GrpcStreamHandle.md)\>\>

***

### openServerStream()

> **openServerStream**(`path`, `payload`, `timeoutMs?`): `Promise`\<`EdgeOperationResult`\<[`GrpcStreamHandle`](GrpcStreamHandle.md)\>\>

#### Parameters

##### path

`string`

##### payload

`Uint8Array`

##### timeoutMs?

`number`

#### Returns

`Promise`\<`EdgeOperationResult`\<[`GrpcStreamHandle`](GrpcStreamHandle.md)\>\>

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
