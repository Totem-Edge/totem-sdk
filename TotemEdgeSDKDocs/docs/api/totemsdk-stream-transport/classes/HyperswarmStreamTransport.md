[**@totemsdk/stream-transport**](../index.md)

***

[@totemsdk/stream-transport](../index.md) / HyperswarmStreamTransport

# Class: HyperswarmStreamTransport

Adapts a raw Hyperswarm connection (which is a Node.js Duplex stream)
to IStreamTransport. This is the production-path adapter used by OmniaSwarmImpl.

Extends NodeStreamTransport with the connection's info (publicKey, topics).

## Extends

- [`NodeStreamTransport`](NodeStreamTransport.md)

## Constructors

### Constructor

> **new HyperswarmStreamTransport**(`conn`, `info`): `HyperswarmStreamTransport`

#### Parameters

##### conn

`unknown`

##### info

###### publicKey

`Buffer`

###### topics?

`Buffer`[]

#### Returns

`HyperswarmStreamTransport`

#### Overrides

[`NodeStreamTransport`](NodeStreamTransport.md).[`constructor`](NodeStreamTransport.md#constructor)

## Properties

### pubkey

> `readonly` **pubkey**: `string`

***

### topics

> `readonly` **topics**: `Buffer`[]

## Methods

### close()

> **close**(): `void`

#### Returns

`void`

#### Inherited from

[`NodeStreamTransport`](NodeStreamTransport.md).[`close`](NodeStreamTransport.md#close)

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

##### Inherited from

[`NodeStreamTransport`](NodeStreamTransport.md).[`on`](NodeStreamTransport.md#on)

#### Call Signature

> **on**(`event`, `handler`): `void`

##### Parameters

###### event

`"close"`

###### handler

[`CloseHandler`](../type-aliases/CloseHandler.md)

##### Returns

`void`

##### Inherited from

[`NodeStreamTransport`](NodeStreamTransport.md).[`on`](NodeStreamTransport.md#on)

#### Call Signature

> **on**(`event`, `handler`): `void`

##### Parameters

###### event

`"error"`

###### handler

[`ErrorHandler`](../type-aliases/ErrorHandler.md)

##### Returns

`void`

##### Inherited from

[`NodeStreamTransport`](NodeStreamTransport.md).[`on`](NodeStreamTransport.md#on)

***

### send()

> **send**(`data`): `void`

#### Parameters

##### data

`Uint8Array`

#### Returns

`void`

#### Inherited from

[`NodeStreamTransport`](NodeStreamTransport.md).[`send`](NodeStreamTransport.md#send)
