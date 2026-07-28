[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / EdgeStreamPort

# Interface: EdgeStreamPort

Bidirectional byte-stream transport port.

Wraps @totemsdk/stream-transport's IStreamTransport as a first-class
Edge runtime port. Use for P2P channel messaging, lookup node connections,
or any protocol that needs a raw bidirectional byte pipe.

## Methods

### close()

> **close**(): `void`

Close the connection.

#### Returns

`void`

***

### onClose()

> **onClose**(`handler`): () => `void`

Register a handler for connection close.

#### Parameters

##### handler

() => `void`

#### Returns

() => `void`

***

### onData()

> **onData**(`handler`): () => `void`

Register a handler for inbound data.

#### Parameters

##### handler

(`data`) => `void`

#### Returns

() => `void`

***

### onError()

> **onError**(`handler`): () => `void`

Register a handler for transport errors.

#### Parameters

##### handler

(`err`) => `void`

#### Returns

() => `void`

***

### send()

> **send**(`data`): `void`

Send raw bytes to the remote peer.

#### Parameters

##### data

`Uint8Array`

#### Returns

`void`
