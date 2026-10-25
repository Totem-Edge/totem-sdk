[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / assembleVirtualChannelClose

# Function: assembleVirtualChannelClose()

> **assembleVirtualChannelClose**(`factory`, `plan`, `signatures`, `verify?`): [`ChannelFactory`](../interfaces/ChannelFactory.md)

Assemble N-of-N VC-close signatures into the updated factory.

## Parameters

### factory

[`ChannelFactory`](../interfaces/ChannelFactory.md)

### plan

[`VirtualChannelClosePlan`](../interfaces/VirtualChannelClosePlan.md)

### signatures

`Record`\<`string`, [`VirtualChannelOpenSignature`](../interfaces/VirtualChannelOpenSignature.md)\>

### verify?

(`sig`, `digest`, `pkd`) => `boolean`

## Returns

[`ChannelFactory`](../interfaces/ChannelFactory.md)
