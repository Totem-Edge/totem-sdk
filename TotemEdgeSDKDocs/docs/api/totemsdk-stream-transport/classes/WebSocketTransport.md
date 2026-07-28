[**@totemsdk/stream-transport**](../index.md)

***

[@totemsdk/stream-transport](../index.md) / WebSocketTransport

# Class: WebSocketTransport

Wraps a browser or Node.js WebSocket as IStreamTransport.
Compatible with both native browser WebSocket and the `ws` npm package.

## Implements

- [`IStreamTransport`](../interfaces/IStreamTransport.md)

## Constructors

### Constructor

> **new WebSocketTransport**(`ws`): `WebSocketTransport`

#### Parameters

##### ws

`unknown`

#### Returns

`WebSocketTransport`

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
