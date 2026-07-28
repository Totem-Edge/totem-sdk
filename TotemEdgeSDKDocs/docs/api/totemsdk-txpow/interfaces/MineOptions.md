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

### forceJs?

> `optional` **forceJs?**: `boolean`

Force the pure-JS mining path even when `miner.wasm` is present.
Useful for testing the JS fallback or comparing JS vs WASM performance.

***

### maxIterations?

> `optional` **maxIterations?**: `number`

Hard cap on total iterations (default: unlimited).
Throws if exhausted without finding a valid nonce.

***

### signal?

> `optional` **signal?**: `AbortSignal`

AbortSignal — rejects the Promise when aborted.

***

### timeMilli?

> `optional` **timeMilli?**: `bigint`

Override the header timestamp (milliseconds since epoch).
Defaults to Date.now(). Set a fixed value for deterministic testing.
