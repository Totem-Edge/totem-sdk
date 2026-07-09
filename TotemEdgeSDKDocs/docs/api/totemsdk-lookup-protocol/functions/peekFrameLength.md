[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / peekFrameLength

# Function: peekFrameLength()

> **peekFrameLength**(`buf`): `number` \| `null`

Read the declared body length from the first 4 bytes of a stream buffer.
Returns null if fewer than 4 bytes are available.
Useful for incremental stream parsers.

## Parameters

### buf

`Uint8Array`

## Returns

`number` \| `null`
