[**@totemsdk/lookup-client**](../index.md)

***

[@totemsdk/lookup-client](../index.md) / ITransport

# Interface: ITransport

Transport abstraction over any duplex byte stream
(Hyperswarm connection, WebSocket, in-memory pair for tests).

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

(`chunk`) => `void`

##### Returns

`void`

#### Call Signature

> **on**(`event`, `handler`): `void`

##### Parameters

###### event

`"close"`

###### handler

() => `void`

##### Returns

`void`

#### Call Signature

> **on**(`event`, `handler`): `void`

##### Parameters

###### event

`"error"`

###### handler

(`err`) => `void`

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
