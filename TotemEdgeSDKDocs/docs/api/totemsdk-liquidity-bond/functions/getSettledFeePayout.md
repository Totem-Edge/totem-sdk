[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / getSettledFeePayout

# Function: getSettledFeePayout()

> **getSettledFeePayout**(`registry`, `ref`): [`SettledFeePayout`](../interfaces/SettledFeePayout.md) \| `undefined`

Look up a registered settled payout without consuming it.

## Parameters

### registry

[`LiquidityBondRegistryState`](../interfaces/LiquidityBondRegistryState.md)

### ref

`Pick`\<[`FeePayoutRef`](../interfaces/FeePayoutRef.md), `"payoutId"` \| `"nonce"`\>

## Returns

[`SettledFeePayout`](../interfaces/SettledFeePayout.md) \| `undefined`
