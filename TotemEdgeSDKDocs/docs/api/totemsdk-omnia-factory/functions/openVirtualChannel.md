[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / openVirtualChannel

# Function: openVirtualChannel()

> **openVirtualChannel**(`factory`, `parties`, `amounts`, `leaseProviders`, `channelId?`): `Promise`\<\{ `channel`: [`OmniaChannel`](../interfaces/OmniaChannel.md); `factory`: [`ChannelFactory`](../interfaces/ChannelFactory.md); \}\>

## Parameters

### factory

[`ChannelFactory`](../interfaces/ChannelFactory.md)

### parties

\[`string`, `string`\]

### amounts

`Record`\<`string`, `bigint`\>

### leaseProviders

`Record`\<`string`, [`WotsLeaseBundle`](../interfaces/WotsLeaseBundle.md)\>

### channelId?

`string`

## Returns

`Promise`\<\{ `channel`: [`OmniaChannel`](../interfaces/OmniaChannel.md); `factory`: [`ChannelFactory`](../interfaces/ChannelFactory.md); \}\>
