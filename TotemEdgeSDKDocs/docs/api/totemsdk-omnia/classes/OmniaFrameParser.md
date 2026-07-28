[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / OmniaFrameParser

# Class: OmniaFrameParser

Accumulates raw incoming bytes and slices out complete length-prefixed
OmniaMessage frames. Not thread-safe — use one parser per stream.

## Constructors

### Constructor

> **new OmniaFrameParser**(): `OmniaFrameParser`

#### Returns

`OmniaFrameParser`

## Methods

### push()

> **push**(`chunk`): [`OmniaMessage`](../interfaces/OmniaMessage.md)[]

#### Parameters

##### chunk

`Uint8Array`

#### Returns

[`OmniaMessage`](../interfaces/OmniaMessage.md)[]

***

### reset()

> **reset**(): `void`

#### Returns

`void`
