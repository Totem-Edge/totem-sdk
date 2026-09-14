[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / listWithdrawablePositions

# Function: listWithdrawablePositions()

> **listWithdrawablePositions**(`state`, `now`): [`LiquidityPosition`](../interfaces/LiquidityPosition.md)[]

Withdrawable means the holder can pull real funded liquidity. A position whose
funding is not chain-confirmed must never appear — a phantom position must not
be withdrawable.

## Parameters

### state

[`LiquidityBondRegistryState`](../interfaces/LiquidityBondRegistryState.md)

### now

`number`

## Returns

[`LiquidityPosition`](../interfaces/LiquidityPosition.md)[]
