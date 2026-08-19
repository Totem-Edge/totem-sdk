[**@totemsdk/stream-transport**](../index.md)

***

[@totemsdk/stream-transport](../index.md) / HyperswarmStreamTransport

# Class: HyperswarmStreamTransport

Adapts a raw Hyperswarm connection (a Node.js Duplex stream) to
IStreamTransport, carrying the connection's info (publicKey, topics).

## Extends

- [`NodeStreamTransport`](NodeStreamTransport.md)

## Constructors

### Constructor

> **new HyperswarmStreamTransport**(`conn`, `info`): `HyperswarmStreamTransport`

#### Parameters

##### conn

`unknown`

##### info

###### publicKey

`Buffer`

###### topics?

`Buffer`\<`ArrayBufferLike`\>[]

#### Returns

`HyperswarmStreamTransport`

#### Overrides

[`NodeStreamTransport`](NodeStreamTransport.md).[`constructor`](NodeStreamTransport.md#constructor)

## Properties

### pubkey

> `readonly` **pubkey**: `string`

***

### topics

> `readonly` **topics**: `Buffer`\<`ArrayBufferLike`\>[]

## Accessors

### state

#### Get Signature

> **get** **state**(): [`TransportState`](../type-aliases/TransportState.md)

Explicit connection state.

##### Returns

[`TransportState`](../type-aliases/TransportState.md)

Explicit connection state.

#### Inherited from

[`NodeStreamTransport`](NodeStreamTransport.md).[`state`](NodeStreamTransport.md#state)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Close the transport. After the returned promise resolves, no further data
or close deliveries occur. Calling close() more than once is safe (the
second call resolves immediately).

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`NodeStreamTransport`](NodeStreamTransport.md).[`close`](NodeStreamTransport.md#close)

***

### onClose()

> **onClose**(`handler`): () => `void`

Subscribe to connection close. Returns an unsubscribe function.

#### Parameters

##### handler

[`CloseHandler`](../type-aliases/CloseHandler.md)

#### Returns

() => `void`

#### Inherited from

[`NodeStreamTransport`](NodeStreamTransport.md).[`onClose`](NodeStreamTransport.md#onclose)

***

### onData()

> **onData**(`handler`): () => `void`

Subscribe to data chunks. Returns an unsubscribe function.

#### Parameters

##### handler

[`DataHandler`](../type-aliases/DataHandler.md)

#### Returns

() => `void`

#### Inherited from

[`NodeStreamTransport`](NodeStreamTransport.md).[`onData`](NodeStreamTransport.md#ondata)

***

### onError()

> **onError**(`handler`): () => `void`

Subscribe to transport errors. Returns an unsubscribe function.

#### Parameters

##### handler

[`ErrorHandler`](../type-aliases/ErrorHandler.md)

#### Returns

() => `void`

#### Inherited from

[`NodeStreamTransport`](NodeStreamTransport.md).[`onError`](NodeStreamTransport.md#onerror)

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

#### Inherited from

[`NodeStreamTransport`](NodeStreamTransport.md).[`send`](NodeStreamTransport.md#send)
