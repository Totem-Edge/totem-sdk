[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / activateLiquidityPosition

# Function: activateLiquidityPosition()

> **activateLiquidityPosition**(`position`, `now?`): [`LiquidityPosition`](../interfaces/LiquidityPosition.md)

Activate a position only after its funding is chain-confirmed. A position
whose proof is merely declared/signed must not reach active liquidity — that
is the phantom-deposit seam.

## Parameters

### position

[`LiquidityPosition`](../interfaces/LiquidityPosition.md)

### now?

`number`

## Returns

[`LiquidityPosition`](../interfaces/LiquidityPosition.md)
