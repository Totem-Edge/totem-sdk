[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / PoolWriterRegistry

# Type Alias: PoolWriterRegistry

> **PoolWriterRegistry** = `Record`\<`string`, `string`\>

Per-pool writer registry (#34): each pool has exactly one authorized signer.
A transition touching a pool must be signed by that pool's writer — an
operator cannot mutate another pool's state.
