[**@totemsdk/stream-transport**](../index.md)

***

[@totemsdk/stream-transport](../index.md) / NodeStreamTransport

# Class: NodeStreamTransport

Wraps any Node.js Duplex-compatible stream (net.Socket, tls.TLSSocket,
Hyperswarm connection, etc.) as IStreamTransport.

## Extended by

- [`HyperswarmStreamTransport`](HyperswarmStreamTransport.md)

## Implements

- [`IStreamTransport`](../interfaces/IStreamTransport.md)

## Constructors

### Constructor

> **new NodeStreamTransport**(`stream`): `NodeStreamTransport`

#### Parameters

##### stream

`unknown`

#### Returns

`NodeStreamTransport`

## Methods

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
