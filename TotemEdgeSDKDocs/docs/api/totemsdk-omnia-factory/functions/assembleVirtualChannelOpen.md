[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / assembleVirtualChannelOpen

# Function: assembleVirtualChannelOpen()

> **assembleVirtualChannelOpen**(`factory`, `plan`, `signatures`, `verify?`): `object`

Assemble N-of-N VC-open signatures into the updated factory + virtual channel.

## Parameters

### factory

[`ChannelFactory`](../interfaces/ChannelFactory.md)

### plan

[`VirtualChannelOpenPlan`](../interfaces/VirtualChannelOpenPlan.md)

### signatures

`Record`\<`string`, [`VirtualChannelOpenSignature`](../interfaces/VirtualChannelOpenSignature.md)\>

### verify?

(`sig`, `digest`, `pkd`) => `boolean`

## Returns

`object`

### channel

> **channel**: [`OmniaChannel`](../interfaces/OmniaChannel.md)

### factory

> **factory**: [`ChannelFactory`](../interfaces/ChannelFactory.md)
