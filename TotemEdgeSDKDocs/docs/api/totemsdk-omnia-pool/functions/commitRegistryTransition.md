[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / commitRegistryTransition

# Function: commitRegistryTransition()

> **commitRegistryTransition**(`params`): `Promise`\<`RegistrySignedTransition`\>

One-shot helper for transitions that do not carry their own rooting context
(e.g. sync mutations like `depositToPool`). Provide the mutated registry plus
an op description and get a signed, anchorable transition record.

## Parameters

### params

#### op

`RegistryOperation`

#### registry

`LiquidityBondRegistryState`

#### rooting

[`RegistryRootingContext`](../interfaces/RegistryRootingContext.md)

## Returns

`Promise`\<`RegistrySignedTransition`\>
