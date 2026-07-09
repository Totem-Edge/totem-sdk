[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / MineOptions

# Interface: MineOptions

## Properties

### chunkSize?

> `optional` **chunkSize?**: `number`

Hash iterations per async yield (default: 10_000).
Lower = more responsive UI; higher = slightly faster mining.

***

### maxIterations?

> `optional` **maxIterations?**: `number`

Hard cap on total iterations (default: unlimited).
Throws if exhausted without finding a valid nonce.

***

### signal?

> `optional` **signal?**: `AbortSignal`

AbortSignal — rejects the Promise when aborted.
