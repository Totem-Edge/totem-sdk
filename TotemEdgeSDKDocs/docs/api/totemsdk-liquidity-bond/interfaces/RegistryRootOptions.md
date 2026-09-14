[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / RegistryRootOptions

# Interface: RegistryRootOptions

## Properties

### domain?

> `optional` **domain?**: `string`

***

### filter?

> `optional` **filter?**: (`registry`) => [`LiquidityBondRegistryState`](LiquidityBondRegistryState.md)

When set, the root is computed over a filtered view of the registry —
e.g. verified-only positions/fees — so an attacker's signed root cannot
look clean over phantom state (#12).

#### Parameters

##### registry

[`LiquidityBondRegistryState`](LiquidityBondRegistryState.md)

#### Returns

[`LiquidityBondRegistryState`](LiquidityBondRegistryState.md)

***

### previousRoot?

> `optional` **previousRoot?**: `string`

***

### reason?

> `optional` **reason?**: `string`

***

### sequence?

> `optional` **sequence?**: `number`

Monotonic anti-reorg sequence (#34) — must advance on every applied transition.

***

### signedAt?

> `optional` **signedAt?**: `number`

***

### signIndices?

> `optional` **signIndices?**: `SigningIndices`

Signing indices bound into the signature (defaults to genesis indices).
