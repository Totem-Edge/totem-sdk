[**@totemsdk/edge-grpc**](../index.md)

***

[@totemsdk/edge-grpc](../index.md) / GrpcStreamHandle

# Interface: GrpcStreamHandle

## Properties

### streamId

> `readonly` **streamId**: `string`

## Methods

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### onData()

> **onData**(`handler`): () => `void`

#### Parameters

##### handler

(`payload`) => `void`

#### Returns

() => `void`

***

### onEnd()

> **onEnd**(`handler`): () => `void`

#### Parameters

##### handler

() => `void`

#### Returns

() => `void`

***

### onError()

> **onError**(`handler`): () => `void`

#### Parameters

##### handler

(`err`) => `void`

#### Returns

() => `void`

***

### send()

> **send**(`payload`): `Promise`\<`void`\>

#### Parameters

##### payload

`Uint8Array`

#### Returns

`Promise`\<`void`\>
