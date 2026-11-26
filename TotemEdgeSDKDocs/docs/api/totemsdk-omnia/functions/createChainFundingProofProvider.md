[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / createChainFundingProofProvider

# Function: createChainFundingProofProvider()

> **createChainFundingProofProvider**(`chainProvider`): [`FundingProofProvider`](../interfaces/FundingProofProvider.md)

Funding proof provider backed by a `ChainStateProvider` that supports
`exportCoin` and `getAddressInfo` (for example a self-hosted Minima RPC node).

Hosted providers that cannot export coin proofs fail closed with an explicit
error instead of fabricating a witness.

## Parameters

### chainProvider

`ChainStateProvider`

## Returns

[`FundingProofProvider`](../interfaces/FundingProofProvider.md)
