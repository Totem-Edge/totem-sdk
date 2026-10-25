[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / RegistrySigningOptions

# Interface: RegistrySigningOptions

Options for `signRegistryTransition`. `signIndices` is **required** (AUD-006):
a reusable genesis default meant every default call signed with the same WOTS
leaf. Callers must supply explicitly leased indices — ideally from a
`@totemsdk/wots-lease` reservation — so a one-time key is never reused.

## Extends

- [`RegistryRootOptions`](RegistryRootOptions.md)

## Properties

### domain?

> `optional` **domain?**: `string`

#### Inherited from

[`RegistryRootOptions`](RegistryRootOptions.md).[`domain`](RegistryRootOptions.md#domain)

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

#### Inherited from

[`RegistryRootOptions`](RegistryRootOptions.md).[`filter`](RegistryRootOptions.md#filter)

***

### previousRoot?

> `optional` **previousRoot?**: `string`

#### Inherited from

[`RegistryRootOptions`](RegistryRootOptions.md).[`previousRoot`](RegistryRootOptions.md#previousroot)

***

### reason?

> `optional` **reason?**: `string`

#### Inherited from

[`RegistryRootOptions`](RegistryRootOptions.md).[`reason`](RegistryRootOptions.md#reason)

***

### sequence?

> `optional` **sequence?**: `number`

Monotonic anti-reorg sequence (#34) — must advance on every applied transition.

#### Inherited from

[`RegistryRootOptions`](RegistryRootOptions.md).[`sequence`](RegistryRootOptions.md#sequence)

***

### signedAt?

> `optional` **signedAt?**: `number`

#### Inherited from

[`RegistryRootOptions`](RegistryRootOptions.md).[`signedAt`](RegistryRootOptions.md#signedat)

***

### signIndices

> **signIndices**: `SigningIndices`

Signing indices bound into the signature. Required for signing
(`RegistrySigningOptions`); the other root helpers ignore it.

#### Overrides

[`RegistryRootOptions`](RegistryRootOptions.md).[`signIndices`](RegistryRootOptions.md#signindices)
