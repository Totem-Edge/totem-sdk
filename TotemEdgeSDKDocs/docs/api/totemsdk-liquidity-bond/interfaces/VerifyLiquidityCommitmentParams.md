[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / VerifyLiquidityCommitmentParams

# Interface: VerifyLiquidityCommitmentParams

## Properties

### chainProvider?

> `optional` **chainProvider?**: [`LiquidityChainFundingVerifier`](LiquidityChainFundingVerifier.md)

On-chain funding verifier. Without it, verified commits return REQUIRES_LIVE_VERIFIER.

***

### commitment

> **commitment**: [`LiquidityCommitment`](LiquidityCommitment.md)

***

### now?

> `optional` **now?**: `number`

***

### pool

> **pool**: [`LiquidityPoolManifest`](LiquidityPoolManifest.md)
