[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / computePoolNAV

# Function: computePoolNAV()

> **computePoolNAV**(`pool`, `registry`, `filter?`): [`PoolNAV`](../interfaces/PoolNAV.md)

Compute the net asset value of a pool from its registry state.

NAV is the number PIPE broadcasts as POOL_NAV, so it must be spoof-proof:
only positions whose funding is chain-confirmed contribute, and only fee
records whose earnings are verified (or non-earnable adjustments) accrue.
An optional `filter` narrows which positions contribute further.

## Parameters

### pool

`LiquidityPoolManifest`

### registry

`LiquidityBondRegistryState`

### filter?

(`position`) => `boolean`

## Returns

[`PoolNAV`](../interfaces/PoolNAV.md)
