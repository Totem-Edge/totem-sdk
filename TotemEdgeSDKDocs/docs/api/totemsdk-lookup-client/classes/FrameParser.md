[**@totemsdk/lookup-client**](../index.md)

***

[@totemsdk/lookup-client](../index.md) / FrameParser

# Class: FrameParser

Accumulates raw incoming bytes and slices out complete length-prefixed frames.
Compatible with the 4-byte big-endian uint32 header from @totemsdk/lookup-protocol.

## Constructors

### Constructor

> **new FrameParser**(): `FrameParser`

#### Returns

`FrameParser`

## Methods

### push()

> **push**(`chunk`): `LookupMessage`[]

#### Parameters

##### chunk

`Uint8Array`

#### Returns

`LookupMessage`[]

***

### reset()

> **reset**(): `void`

#### Returns

`void`
