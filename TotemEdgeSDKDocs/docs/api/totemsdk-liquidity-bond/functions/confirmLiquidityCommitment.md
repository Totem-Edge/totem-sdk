[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / confirmLiquidityCommitment

# Function: confirmLiquidityCommitment()

> **confirmLiquidityCommitment**(`commitment`, `chainProvider`, `now?`): `Promise`\<[`LiquidityCommitment`](../interfaces/LiquidityCommitment.md)\>

Confirm a commitment's funding on-chain and mark it chain-confirmed. Returns
REQUIRES_LIVE_VERIFIER when no funding/verifier is present so the caller can
refuse to proceed rather than trusting a declared string.

## Parameters

### commitment

[`LiquidityCommitment`](../interfaces/LiquidityCommitment.md)

### chainProvider

[`LiquidityChainFundingVerifier`](../interfaces/LiquidityChainFundingVerifier.md)

### now?

`number`

## Returns

`Promise`\<[`LiquidityCommitment`](../interfaces/LiquidityCommitment.md)\>
