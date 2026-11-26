[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / assertSettledFeePayoutUsable

# Function: assertSettledFeePayoutUsable()

> **assertSettledFeePayoutUsable**(`registry`, `ref`, `binding`): [`SettledFeePayout`](../interfaces/SettledFeePayout.md)

Validate that a payout reference is a known, unconsumed, correctly bound
settled payout — without consuming it. Unknown, mismatched and reused
references are rejected.

## Parameters

### registry

[`LiquidityBondRegistryState`](../interfaces/LiquidityBondRegistryState.md)

### ref

[`FeePayoutRef`](../interfaces/FeePayoutRef.md)

### binding

#### poolId

`string`

#### positionId

`string`

## Returns

[`SettledFeePayout`](../interfaces/SettledFeePayout.md)
