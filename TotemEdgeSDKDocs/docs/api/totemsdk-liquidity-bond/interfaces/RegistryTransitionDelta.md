[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / RegistryTransitionDelta

# Interface: RegistryTransitionDelta

## Properties

### op

> **op**: [`RegistryOperation`](RegistryOperation.md)

***

### opHash

> **opHash**: `string`

***

### previousRoot?

> `optional` **previousRoot?**: `string`

***

### reason?

> `optional` **reason?**: `string`

***

### root

> **root**: `string`

***

### sequence?

> `optional` **sequence?**: `number`

Monotonic anti-reorg sequence (#34) — must advance on every applied transition.

***

### signedAt

> **signedAt**: `number`
