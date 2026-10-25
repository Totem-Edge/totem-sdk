[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / factoryDistributionOutputs

# Function: factoryDistributionOutputs()

> **factoryDistributionOutputs**(`participants`, `tokenId?`): [`FactoryDistributionOutput`](../interfaces/FactoryDistributionOutput.md)[]

The exact payout set the pre-signed all-party distribution must contain — one
output per participant, paying its committed balance (RFC-048 §12.4). Its sum
equals `factoryBalanceSetRoot(...).rootSum`.

## Parameters

### participants

[`FactoryParticipant`](../interfaces/FactoryParticipant.md)[]

### tokenId?

`string` = `'0x00'`

## Returns

[`FactoryDistributionOutput`](../interfaces/FactoryDistributionOutput.md)[]
