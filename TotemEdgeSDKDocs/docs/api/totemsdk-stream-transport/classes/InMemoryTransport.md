[**@totemsdk/stream-transport**](../index.md)

***

[@totemsdk/stream-transport](../index.md) / InMemoryTransport

# Class: InMemoryTransport

In-process bidirectional transport for use in unit tests.
Call createInMemoryPair() to get two linked InMemoryTransport instances.

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

> **close**(): `void`

#### Returns

`void`

#### Implementation of

[`IStreamTransport`](../interfaces/IStreamTransport.md).[`close`](../interfaces/IStreamTransport.md#close)

***

### on()

#### Call Signature

> **on**(`event`, `handler`): `void`

##### Parameters

###### event

`"data"`

###### handler

[`DataHandler`](../type-aliases/DataHandler.md)

##### Returns

`void`

##### Implementation of

[`IStreamTransport`](../interfaces/IStreamTransport.md).[`on`](../interfaces/IStreamTransport.md#on)

#### Call Signature

> **on**(`event`, `handler`): `void`

##### Parameters

###### event

`"close"`

###### handler

[`CloseHandler`](../type-aliases/CloseHandler.md)

##### Returns

`void`

##### Implementation of

[`IStreamTransport`](../interfaces/IStreamTransport.md).[`on`](../interfaces/IStreamTransport.md#on)

#### Call Signature

> **on**(`event`, `handler`): `void`

##### Parameters

###### event

`"error"`

###### handler

[`ErrorHandler`](../type-aliases/ErrorHandler.md)

##### Returns

`void`

##### Implementation of

[`IStreamTransport`](../interfaces/IStreamTransport.md).[`on`](../interfaces/IStreamTransport.md#on)

***

### send()

> **send**(`data`): `void`

#### Parameters

##### data

`Uint8Array`

#### Returns

`void`

#### Implementation of

[`IStreamTransport`](../interfaces/IStreamTransport.md).[`send`](../interfaces/IStreamTransport.md#send)

***

### simulateRemoteClose()

> **simulateRemoteClose**(): `void`

Fire 'close' on BOTH sides asynchronously.
Use when simulating a remote side terminating the connection.

#### Returns

`void`
