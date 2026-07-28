[**@totemsdk/stream-transport**](../index.md)

***

[@totemsdk/stream-transport](../index.md) / WebRTCDataChannelTransport

# Class: WebRTCDataChannelTransport

Wraps an RTCDataChannel (browser WebRTC) as IStreamTransport.
Requires the RTCDataChannel to be in arraybuffer mode.

## Implements

- [`IStreamTransport`](../interfaces/IStreamTransport.md)

## Constructors

### Constructor

> **new WebRTCDataChannelTransport**(`channel`): `WebRTCDataChannelTransport`

#### Parameters

##### channel

`unknown`

#### Returns

`WebRTCDataChannelTransport`

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
