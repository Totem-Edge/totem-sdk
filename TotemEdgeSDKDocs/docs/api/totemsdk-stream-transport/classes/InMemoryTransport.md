[**@totemsdk/stream-transport**](../index.md)

***

[@totemsdk/stream-transport](../index.md) / InMemoryTransport

# Class: InMemoryTransport

In-process bidirectional transport for use in unit tests and the contract
suite. Call createInMemoryPair() to get two linked instances.

Extra test-helper methods:
  _deliver(event, ...args)   — fire event handlers on this side only
  _deliverClose()            — fire 'close' on this side's handlers only
  simulateRemoteClose()      — fire 'close' on BOTH sides (asynchronous)
  _simulateServerClose()     — alias for simulateRemoteClose()
  _linkPeer(other)           — link two transports together

## Implements

- [`IStreamTransport`](../interfaces/IStreamTransport.md)

## Constructors

### Constructor

> **new InMemoryTransport**(): `InMemoryTransport`

#### Returns

`InMemoryTransport`

## Accessors

### state

#### Get Signature

> **get** **state**(): [`TransportState`](../type-aliases/TransportState.md)

Explicit connection state.

##### Returns

[`TransportState`](../type-aliases/TransportState.md)

Explicit connection state.

#### Implementation of

[`IStreamTransport`](../interfaces/IStreamTransport.md).[`state`](../interfaces/IStreamTransport.md#state)

## Methods

### \_deliver()

> **\_deliver**(`event`, ...`args`): `void`

Fire event handlers on THIS side only.

#### Parameters

##### event

`string`

##### args

...`unknown`[]

#### Returns

`void`

***

### \_deliverClose()

> **\_deliverClose**(): `void`

Fire 'close' on this side's handlers only (for reconnect testing).

#### Returns

`void`

***

### \_linkPeer()

> **\_linkPeer**(`other`): `void`

#### Parameters

##### other

`InMemoryTransport`

#### Returns

`void`

***

### \_simulateServerClose()

> **\_simulateServerClose**(): `void`

Alias for simulateRemoteClose().

#### Returns

`void`

***

### close()

> **close**(): `Promise`\<`void`\>

Close the transport. After the returned promise resolves, no further data
or close deliveries occur. Calling close() more than once is safe (the
second call resolves immediately).

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IStreamTransport`](../interfaces/IStreamTransport.md).[`close`](../interfaces/IStreamTransport.md#close)

***

### onClose()

> **onClose**(`handler`): () => `void`

Subscribe to connection close. Returns an unsubscribe function.

#### Parameters

##### handler

[`CloseHandler`](../type-aliases/CloseHandler.md)

#### Returns

() => `void`

#### Implementation of

[`IStreamTransport`](../interfaces/IStreamTransport.md).[`onClose`](../interfaces/IStreamTransport.md#onclose)

***

### onData()

> **onData**(`handler`): () => `void`

Subscribe to data chunks. Returns an unsubscribe function.

#### Parameters

##### handler

[`DataHandler`](../type-aliases/DataHandler.md)

#### Returns

() => `void`

#### Implementation of

[`IStreamTransport`](../interfaces/IStreamTransport.md).[`onData`](../interfaces/IStreamTransport.md#ondata)

***

### onError()

> **onError**(`handler`): () => `void`

Subscribe to transport errors. Returns an unsubscribe function.

#### Parameters

##### handler

[`ErrorHandler`](../type-aliases/ErrorHandler.md)

#### Returns

() => `void`

#### Implementation of

[`IStreamTransport`](../interfaces/IStreamTransport.md).[`onError`](../interfaces/IStreamTransport.md#onerror)

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

[`IStreamTransport`](../interfaces/IStreamTransport.md).[`send`](../interfaces/IStreamTransport.md#send)

***

### simulateRemoteClose()

> **simulateRemoteClose**(): `void`

Fire 'close' on BOTH sides asynchronously.
Use when simulating a remote side terminating the connection.

#### Returns

`void`
