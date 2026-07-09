[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / CreateChannelParams

# Interface: CreateChannelParams

## Properties

### channelType?

> `optional` **channelType?**: `"direct"` \| `"virtual"`

***

### factoryRef?

> `optional` **factoryRef?**: `string`

***

### fundingCoinId

> **fundingCoinId**: `string`

***

### localAmount

> **localAmount**: `bigint`

***

### localParty

> **localParty**: [`ChannelParticipant`](ChannelParticipant.md)

***

### remoteAmount

> **remoteAmount**: `bigint`

***

### remoteParty

> **remoteParty**: [`ChannelParticipant`](ChannelParticipant.md)

***

### tokenId?

> `optional` **tokenId?**: `string`

***

### tokenScale?

> `optional` **tokenScale?**: `number`

Scale factor for coloured coins. 0 = native Minima. Default: 0.
