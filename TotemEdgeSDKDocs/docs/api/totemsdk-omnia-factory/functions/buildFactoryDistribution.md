[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / buildFactoryDistribution

# Function: buildFactoryDistribution()

> **buildFactoryDistribution**(`factory`, `params`): [`FactoryDistribution`](../interfaces/FactoryDistribution.md)

Build the distribution transaction for the factory coin. The output order
matches the participant order used by the covenant, and every amount comes
from the committed allocation.

## Parameters

### factory

[`ChannelFactory`](../interfaces/ChannelFactory.md)

### params

#### fundingAddress?

`string`

#### fundingCoinId

`string`

## Returns

[`FactoryDistribution`](../interfaces/FactoryDistribution.md)
