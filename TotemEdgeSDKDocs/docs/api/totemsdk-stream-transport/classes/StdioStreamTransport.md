[**@totemsdk/stream-transport**](../index.md)

***

[@totemsdk/stream-transport](../index.md) / StdioStreamTransport

# Class: StdioStreamTransport

Adapts process.stdin + process.stdout (or any pair of Readable+Writable)
as IStreamTransport. Useful for CLI tools and pipe-based IPC.

## Implements

- [`IStreamTransport`](../interfaces/IStreamTransport.md)

## Constructors

### Constructor

> **new StdioStreamTransport**(`input?`, `output?`): `StdioStreamTransport`

#### Parameters

##### input?

`unknown` = `process.stdin`

##### output?

`unknown` = `process.stdout`

#### Returns

`StdioStreamTransport`

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
