[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / acceptLiquidityCommitment

# Function: acceptLiquidityCommitment()

> **acceptLiquidityCommitment**(`commitment`, `opts?`): `Promise`\<[`LiquidityCommitment`](../interfaces/LiquidityCommitment.md)\>

Accept a commitment. Only a commitment whose funding is chain-confirmed is
acceptable — a draft/signed commitment has only self-declared funding. When
`chainProvider` and a confirmed funding are passed in, the on-chain gate is
re-checked here; otherwise acceptance refuses the phantom-deposit path.

## Parameters

### commitment

[`LiquidityCommitment`](../interfaces/LiquidityCommitment.md)

### opts?

#### chainProvider?

[`LiquidityChainFundingVerifier`](../interfaces/LiquidityChainFundingVerifier.md)

#### now?

`number`

## Returns

`Promise`\<[`LiquidityCommitment`](../interfaces/LiquidityCommitment.md)\>
