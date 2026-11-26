[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / createWalletFundingWitnessBuilder

# Function: createWalletFundingWitnessBuilder()

> **createWalletFundingWitnessBuilder**(`options`): [`FundingWitnessBuilder`](../interfaces/FundingWitnessBuilder.md)

Reference wallet funding-witness builder.

The wallet signs the exact funding digest produced by `buildChannelOpening`
and supplies the coin proof + address script. The lease is committed on
success and burned on failure, so a failed open never reuses a WOTS leaf.

## Parameters

### options

[`WalletFundingWitnessBuilderOptions`](../interfaces/WalletFundingWitnessBuilderOptions.md)

## Returns

[`FundingWitnessBuilder`](../interfaces/FundingWitnessBuilder.md)
