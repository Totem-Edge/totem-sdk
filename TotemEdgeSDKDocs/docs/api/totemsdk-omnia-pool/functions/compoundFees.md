[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / compoundFees

# Function: compoundFees()

> **compoundFees**(`pool`, `position`, `registry`, `opts`): `object`

Compound accrued LP fees back into the position's principal. Like claims,
compounding is bound to a settled payout so the entitlement is only zeroed
against a real execution.

## Parameters

### pool

`LiquidityPoolManifest`

### position

`LiquidityPosition`

### registry

`LiquidityBondRegistryState`

### opts

[`CompoundFeesOptions`](../interfaces/CompoundFeesOptions.md)

## Returns

`object`

### compoundedAmount

> **compoundedAmount**: `bigint`

### position

> **position**: `LiquidityPosition`

### registry

> **registry**: `LiquidityBondRegistryState`
