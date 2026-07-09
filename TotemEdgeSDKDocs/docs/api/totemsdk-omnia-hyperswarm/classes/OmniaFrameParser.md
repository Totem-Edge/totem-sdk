[**@totemsdk/omnia-hyperswarm**](../index.md)

***

[@totemsdk/omnia-hyperswarm](../index.md) / OmniaFrameParser

# Class: OmniaFrameParser

Accumulates raw incoming bytes and slices out complete length-prefixed
OmniaMessage frames. Thread-safety: not thread-safe — use one parser per stream.

## Constructors

### Constructor

> **new OmniaFrameParser**(): `OmniaFrameParser`

#### Returns

`OmniaFrameParser`

## Methods

### push()

> **push**(`chunk`): [`OmniaMessage`](../interfaces/OmniaMessage.md)[]

Push a new chunk of bytes into the parser.
Returns all complete OmniaMessage frames decoded from the accumulated buffer.
Throws `FramingError` on corrupt frames (truncated JSON, bad length).

#### Parameters

##### chunk

`Uint8Array`

#### Returns

[`OmniaMessage`](../interfaces/OmniaMessage.md)[]

***

### reset()

> **reset**(): `void`

Reset internal buffer. Call after a stream reconnects.

#### Returns

`void`
