[**@totemsdk/pear**](../index.md)

***

[@totemsdk/pear](../index.md) / IStreamTransport

# Interface: IStreamTransport

Canonical bidirectional byte-stream transport contract.

Every transport exposes the same subscription API; each `on*` method returns
an unsubscribe function so handlers can always be removed. There is a single
connection state machine and a single `send` signature. This replaces the old
`on(event, handler)` API which could not express unsubscription, backpressure
or connection state.

## Properties

### state

> `readonly` **state**: `TransportState`

Explicit connection state.

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Close the transport. After the returned promise resolves, no further data
or close deliveries occur. Calling close() more than once is safe (the
second call resolves immediately).

#### Returns

`Promise`\<`void`\>

***

### connect()?

> `optional` **connect**(): `Promise`\<`void`\>

Optional async connect. Implementations that construct an already-connected
transport may omit it.

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

***

### onData()

> **onData**(`handler`): () => `void`

Subscribe to data chunks. Returns an unsubscribe function.

#### Parameters

##### handler

`DataHandler`

#### Returns

() => `void`

***

### onError()

> **onError**(`handler`): () => `void`

Subscribe to transport errors. Returns an unsubscribe function.

#### Parameters

##### handler

`ErrorHandler`

#### Returns

() => `void`

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
