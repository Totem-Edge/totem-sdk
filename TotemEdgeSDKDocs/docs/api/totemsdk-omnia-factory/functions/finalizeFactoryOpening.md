[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / finalizeFactoryOpening

# Function: finalizeFactoryOpening()

> **finalizeFactoryOpening**(`plan`, `opts`, `chainProvider?`): `Promise`\<[`ChannelFactory`](../interfaces/ChannelFactory.md)\>

Broadcast the prepared factory funding (when on-chain) and record opening
signatures. When every participant signature is supplied the factory commits.

## Parameters

### plan

[`FactoryOpeningPlan`](../interfaces/FactoryOpeningPlan.md)

### opts

[`FinalizeFactoryOpeningOptions`](../interfaces/FinalizeFactoryOpeningOptions.md)

### chainProvider?

`ChainStateProvider`

## Returns

`Promise`\<[`ChannelFactory`](../interfaces/ChannelFactory.md)\>
