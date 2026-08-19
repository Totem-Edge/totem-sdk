[**@totemsdk/edge-grpc**](../index.md)

***

[@totemsdk/edge-grpc](../index.md) / GrpcClient

# Interface: GrpcClient

## Methods

### bidiStream()

> **bidiStream**(`path`, `deadlineMs?`): `Promise`\<[`GrpcStreamHandle`](GrpcStreamHandle.md)\>

#### Parameters

##### path

`string`

##### deadlineMs?

`number`

#### Returns

`Promise`\<[`GrpcStreamHandle`](GrpcStreamHandle.md)\>

***

### clientStream()

> **clientStream**(`path`, `deadlineMs?`): `Promise`\<[`GrpcStreamHandle`](GrpcStreamHandle.md)\>

#### Parameters

##### path

`string`

##### deadlineMs?

`number`

#### Returns

`Promise`\<[`GrpcStreamHandle`](GrpcStreamHandle.md)\>

***

### serverStream()

> **serverStream**(`path`, `payload`, `deadlineMs?`): `Promise`\<[`GrpcStreamHandle`](GrpcStreamHandle.md)\>

#### Parameters

##### path

`string`

##### payload

`Uint8Array`

##### deadlineMs?

`number`

#### Returns

`Promise`\<[`GrpcStreamHandle`](GrpcStreamHandle.md)\>

***

### unaryCall()

> **unaryCall**(`path`, `payload`, `deadlineMs?`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

#### Parameters

##### path

`string`

##### payload

`Uint8Array`

##### deadlineMs?

`number`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>
