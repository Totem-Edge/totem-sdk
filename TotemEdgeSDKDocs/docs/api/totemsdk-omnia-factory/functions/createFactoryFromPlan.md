[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / createFactoryFromPlan

# Function: createFactoryFromPlan()

> **createFactoryFromPlan**(`plan`, `bundle`, `chainProvider?`): `Promise`\<[`ChannelFactory`](../interfaces/ChannelFactory.md)\>

Finish a plan: collect the funding-witness signatures from the plan's
funding materials (or use the supplied ones), broadcast the funding
transaction when the plan is on-chain, and commit the opening once every
participant has signed.

## Parameters

### plan

[`FactoryOpeningPlan`](../interfaces/FactoryOpeningPlan.md)

### bundle

[`WotsLeaseBundle`](../interfaces/WotsLeaseBundle.md)

### chainProvider?

`ChainStateProvider`

## Returns

`Promise`\<[`ChannelFactory`](../interfaces/ChannelFactory.md)\>
