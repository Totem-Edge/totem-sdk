[**@totemsdk/edge-grpc**](../index.md)

***

[@totemsdk/edge-grpc](../index.md) / NativeGrpcTransport

# Class: NativeGrpcTransport

## Implements

- `unknown`

## Constructors

### Constructor

> **new NativeGrpcTransport**(`config?`): `NativeGrpcTransport`

#### Parameters

##### config?

[`NativeGrpcConfig`](../interfaces/NativeGrpcConfig.md) = `{}`

#### Returns

`NativeGrpcTransport`

## Methods

### close()

> **close**(): `void`

#### Returns

`void`

***

### connect()

> **connect**(`address`): `Promise`\<`void`\>

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`void`\>

***

### disconnect()

> **disconnect**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### onClose()

> **onClose**(`handler`): `void`

#### Parameters

##### handler

`CloseHandler`

#### Returns

`void`

***

### onData()

> **onData**(`handler`): `void`

#### Parameters

##### handler

`DataHandler`

#### Returns

`void`

***

### onError()

> **onError**(`handler`): `void`

#### Parameters

##### handler

`ErrorHandler`

#### Returns

`void`

***

### send()

> **send**(`data`): `Promise`\<`void`\>

#### Parameters

##### data

`Uint8Array`

#### Returns

`Promise`\<`void`\>
