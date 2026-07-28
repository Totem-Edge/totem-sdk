[**@totemsdk/stream-transport**](../index.md)

***

[@totemsdk/stream-transport](../index.md) / IStreamTransport

# Interface: IStreamTransport

Minimal bidirectional byte-stream interface.

send()  — write bytes to the remote peer
on()    — subscribe to 'data', 'close', or 'error' events
close() — half-close / destroy the connection

## Methods

### close()

> **close**(): `void`

#### Returns

`void`

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

#### Call Signature

> **on**(`event`, `handler`): `void`

##### Parameters

###### event

`"close"`

###### handler

[`CloseHandler`](../type-aliases/CloseHandler.md)

##### Returns

`void`

#### Call Signature

> **on**(`event`, `handler`): `void`

##### Parameters

###### event

`"error"`

###### handler

[`ErrorHandler`](../type-aliases/ErrorHandler.md)

##### Returns

`void`

***

### send()

> **send**(`data`): `void`

#### Parameters

##### data

`Uint8Array`

#### Returns

`void`
