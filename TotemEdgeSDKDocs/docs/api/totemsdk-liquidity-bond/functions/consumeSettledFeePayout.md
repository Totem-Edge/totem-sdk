[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / consumeSettledFeePayout

# Function: consumeSettledFeePayout()

> **consumeSettledFeePayout**(`registry`, `ref`, `binding`): [`LiquidityBondRegistryState`](../interfaces/LiquidityBondRegistryState.md)

Consume a settled payout for a fee claim/compound. Unknown references,
references bound to another position/pool, and already-consumed references
are rejected — a payout is single-use and cannot release fees twice.

## Parameters

### registry

[`LiquidityBondRegistryState`](../interfaces/LiquidityBondRegistryState.md)

### ref

[`FeePayoutRef`](../interfaces/FeePayoutRef.md)

### binding

#### amount

`bigint`

#### consumedBy

`string`

#### poolId

`string`

#### positionId

`string`

## Returns

[`LiquidityBondRegistryState`](../interfaces/LiquidityBondRegistryState.md)
