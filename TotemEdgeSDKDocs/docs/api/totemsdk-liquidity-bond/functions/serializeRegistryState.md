[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / serializeRegistryState

# Function: serializeRegistryState()

> **serializeRegistryState**(`registry`): `string`

Canonical serialization of a registry state. Excludes the volatile `updatedAt`
stamp AND the anchor `root`/`sequence` so identical content (and the chain
position) always serializes identically and a root depends only on the state
it commits.

## Parameters

### registry

[`LiquidityBondRegistryState`](../interfaces/LiquidityBondRegistryState.md)

## Returns

`string`
