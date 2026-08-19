[**@totemsdk/edge-grpc**](../index.md)

***

[@totemsdk/edge-grpc](../index.md) / NativeGrpcTransport

# Class: NativeGrpcTransport

## Implements

- `IStreamTransport`

## Constructors

### Constructor

> **new NativeGrpcTransport**(`config?`): `NativeGrpcTransport`

#### Parameters

##### config?

[`NativeGrpcConfig`](../interfaces/NativeGrpcConfig.md) = `{}`

#### Returns

`NativeGrpcTransport`

## Accessors

### state

#### Get Signature

> **get** **state**(): `"connecting"` \| `"open"` \| `"closing"` \| `"closed"`

Explicit connection state.

##### Returns

`"connecting"` \| `"open"` \| `"closing"` \| `"closed"`

#### Implementation of

`IStreamTransport.state`

## Methods

### bidiStream()

> **bidiStream**(`path`, `deadlineMs?`): `Promise`\<[`GrpcStreamHandle`](../interfaces/GrpcStreamHandle.md)\>

#### Parameters

##### path

`string`

##### deadlineMs?

`number`

#### Returns

`Promise`\<[`GrpcStreamHandle`](../interfaces/GrpcStreamHandle.md)\>

***

### clientStream()

> **clientStream**(`path`, `deadlineMs?`): `Promise`\<[`GrpcStreamHandle`](../interfaces/GrpcStreamHandle.md)\>

#### Parameters

##### path

`string`

##### deadlineMs?

`number`

#### Returns

`Promise`\<[`GrpcStreamHandle`](../interfaces/GrpcStreamHandle.md)\>

***

### close()

> **close**(): `Promise`\<`void`\>

Close the transport. After the returned promise resolves, no further data
or close deliveries occur. Calling close() more than once is safe (the
second call resolves immediately).

#### Returns

`Promise`\<`void`\>

#### Implementation of

`IStreamTransport.close`

***

### connect()

> **connect**(`address?`): `Promise`\<`void`\>

Optional async connect. Implementations that construct an already-connected
transport may omit it.

#### Parameters

##### address?

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

`IStreamTransport.connect`

***

### disconnect()

> **disconnect**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### onClose()

> **onClose**(`handler`): () => `void`

Subscribe to connection close. Returns an unsubscribe function.

#### Parameters

##### handler

`CloseHandler`

#### Returns

() => `void`

#### Implementation of

`IStreamTransport.onClose`

***

### onData()

> **onData**(`handler`): () => `void`

Subscribe to data chunks. Returns an unsubscribe function.

#### Parameters

##### handler

`DataHandler`

#### Returns

() => `void`

#### Implementation of

`IStreamTransport.onData`

***

### onError()

> **onError**(`handler`): () => `void`

Subscribe to transport errors. Returns an unsubscribe function.

#### Parameters

##### handler

`ErrorHandler`

#### Returns

() => `void`

#### Implementation of

`IStreamTransport.onError`

***

### send()

> **send**(`data`): `Promise`\<`void`\>

Send bytes to the remote peer.

- Returns a promise that resolves once the bytes are accepted by the
  underlying transport (or after the documented backpressure policy).
- Rejects with `ClosedTransportError` if the transport is closed.
- Rejects with the underlying error if delivery fails.

#### Parameters

##### data

`Uint8Array`

#### Returns

`Promise`\<`void`\>

#### Implementation of

`IStreamTransport.send`

***

### serverStream()

> **serverStream**(`path`, `payload`, `deadlineMs?`): `Promise`\<[`GrpcStreamHandle`](../interfaces/GrpcStreamHandle.md)\>

#### Parameters

##### path

`string`

##### payload

`Uint8Array`

##### deadlineMs?

`number`

#### Returns

`Promise`\<[`GrpcStreamHandle`](../interfaces/GrpcStreamHandle.md)\>

***

### streamClose()

> **streamClose**(`streamId`): `Promise`\<`void`\>

#### Parameters

##### streamId

`string`

#### Returns

`Promise`\<`void`\>

***

### streamSend()

> **streamSend**(`streamId`, `payload`): `Promise`\<`void`\>

#### Parameters

##### streamId

`string`

##### payload

`Uint8Array`

#### Returns

`Promise`\<`void`\>

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
