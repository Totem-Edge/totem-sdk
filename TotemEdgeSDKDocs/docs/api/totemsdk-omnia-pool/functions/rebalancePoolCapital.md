[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / rebalancePoolCapital

# Function: rebalancePoolCapital()

> **rebalancePoolCapital**(`params`, `position`, `registry`): `Promise`\<\{ `newAllocation`: `LiquidityAllocation`; `position`: `LiquidityPosition`; `registry`: `LiquidityBondRegistryState`; `released`: `LiquidityAllocation`; \}\>

Rebalance capital from one allocation to another target/backend.

## Parameters

### params

[`RebalanceAllocationParams`](../type-aliases/RebalanceAllocationParams.md)

### position

`LiquidityPosition`

### registry

`LiquidityBondRegistryState`

## Returns

`Promise`\<\{ `newAllocation`: `LiquidityAllocation`; `position`: `LiquidityPosition`; `registry`: `LiquidityBondRegistryState`; `released`: `LiquidityAllocation`; \}\>
