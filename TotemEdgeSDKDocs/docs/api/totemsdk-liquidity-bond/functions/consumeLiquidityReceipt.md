[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / consumeLiquidityReceipt

# Function: consumeLiquidityReceipt()

> **consumeLiquidityReceipt**(`receipt`, `intentId`, `now?`): [`LiquidityReceipt`](../interfaces/LiquidityReceipt.md)

Consume a receipt for a withdrawal — single-spend (#8). A consumed receipt
can never be replayed against another withdrawal.

## Parameters

### receipt

[`LiquidityReceipt`](../interfaces/LiquidityReceipt.md)

### intentId

`string`

### now?

`number`

## Returns

[`LiquidityReceipt`](../interfaces/LiquidityReceipt.md)
