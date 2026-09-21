[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / maybeSignTransition

# Function: maybeSignTransition()

> **maybeSignTransition**(`rooting`, `registry`, `op`, `previousRoot?`): `Promise`\<`RegistrySignedTransition` \| `undefined`\>

Sign the resulting registry when a rooting context is provided, otherwise
return `undefined` (pure-record mode, no anchoring).

## Parameters

### rooting

[`RegistryRootingContext`](../interfaces/RegistryRootingContext.md) \| `undefined`

### registry

`LiquidityBondRegistryState`

### op

`RegistryOperation`

### previousRoot?

`string`

## Returns

`Promise`\<`RegistrySignedTransition` \| `undefined`\>
