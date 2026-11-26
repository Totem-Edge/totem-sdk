[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / proposeFactoryOpening

# Function: proposeFactoryOpening()

> **proposeFactoryOpening**(`plan`, `bundle`): `Promise`\<[`ChannelFactory`](../interfaces/ChannelFactory.md)\>

Sign the opening commitment for a plan and record the proposer's signature.
Nothing is broadcast and no funding signature is requested, so callers can
propose the factory to the peer first (CAN-020 ordering).

## Parameters

### plan

[`FactoryOpeningPlan`](../interfaces/FactoryOpeningPlan.md)

### bundle

[`WotsLeaseBundle`](../interfaces/WotsLeaseBundle.md)

## Returns

`Promise`\<[`ChannelFactory`](../interfaces/ChannelFactory.md)\>
