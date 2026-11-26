[**@totemsdk/edge-gnss**](../index.md)

***

[@totemsdk/edge-gnss](../index.md) / NmeaFixOptions

# Interface: NmeaFixOptions

## Properties

### now?

> `optional` **now?**: `number`

Fallback timestamp when the sentences carry no date/time. Default Date.now().

***

### raw?

> `optional` **raw?**: `Uint8Array`\<`ArrayBufferLike`\>

Raw receiver payload for the fix.

***

### source?

> `optional` **source?**: `string`

Source label carried into the fix. Default "gnss".
