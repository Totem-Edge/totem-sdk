[**@totemsdk/lookup-node**](../index.md)

***

[@totemsdk/lookup-node](../index.md) / HyperswarmTransport

# Class: HyperswarmTransport

Adapts a Node.js Duplex stream (Hyperswarm connection) to the ITransport
interface used by ClientSession. Buffers binary frames and emits 'data'
events with raw Uint8Array chunks.

## Implements

- [`ITransport`](../interfaces/ITransport.md)

## Constructors

### Constructor

> **new HyperswarmTransport**(`_stream`): `HyperswarmTransport`

#### Parameters

##### \_stream

`Duplex`

#### Returns

`HyperswarmTransport`

## Methods

### close()

> **close**(): `void`

#### Returns

`void`

#### Implementation of

[`ITransport`](../interfaces/ITransport.md).[`close`](../interfaces/ITransport.md#close)

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

##### Implementation of

[`ITransport`](../interfaces/ITransport.md).[`on`](../interfaces/ITransport.md#on)

#### Call Signature

> **on**(`event`, `handler`): `void`

##### Parameters

###### event

`"close"`

###### handler

() => `void`

##### Returns

`void`

##### Implementation of

[`ITransport`](../interfaces/ITransport.md).[`on`](../interfaces/ITransport.md#on)

#### Call Signature

> **on**(`event`, `handler`): `void`

##### Parameters

###### event

`"error"`

###### handler

(`err`) => `void`

##### Returns

`void`

##### Implementation of

[`ITransport`](../interfaces/ITransport.md).[`on`](../interfaces/ITransport.md#on)

***

### send()

> **send**(`data`): `void`

#### Parameters

##### data

`Uint8Array`

#### Returns

`void`

#### Implementation of

[`ITransport`](../interfaces/ITransport.md).[`send`](../interfaces/ITransport.md#send)
