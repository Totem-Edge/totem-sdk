[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / buildVirtualChannelOpen

# Function: buildVirtualChannelOpen()

> **buildVirtualChannelOpen**(`factory`, `parties`, `amounts`, `channelId?`): [`VirtualChannelOpenPlan`](../interfaces/VirtualChannelOpenPlan.md)

Validate + build the VC-open plan (no signing). Exported so peers can bind.

## Parameters

### factory

[`ChannelFactory`](../interfaces/ChannelFactory.md)

### parties

\[`string`, `string`\]

### amounts

`Record`\<`string`, `bigint`\>

### channelId?

`string`

## Returns

[`VirtualChannelOpenPlan`](../interfaces/VirtualChannelOpenPlan.md)
