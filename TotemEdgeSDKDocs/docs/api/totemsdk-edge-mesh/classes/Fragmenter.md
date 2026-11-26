[**@totemsdk/edge-mesh**](../index.md)

***

[@totemsdk/edge-mesh](../index.md) / Fragmenter

# Class: Fragmenter

## Constructors

### Constructor

> **new Fragmenter**(`mtu`): `Fragmenter`

#### Parameters

##### mtu

`number`

#### Returns

`Fragmenter`

## Properties

### mtu

> `readonly` **mtu**: `number`

***

### payloadPerPacket

> `readonly` **payloadPerPacket**: `number`

## Methods

### fragment()

> **fragment**(`msgId`, `frame`, `hops?`): `Uint8Array`\<`ArrayBufferLike`\>[]

#### Parameters

##### msgId

`number`

##### frame

`Uint8Array`

##### hops?

`number` = `0`

#### Returns

`Uint8Array`\<`ArrayBufferLike`\>[]

***

### maxFrameBytes()

> **maxFrameBytes**(): `number`

#### Returns

`number`
