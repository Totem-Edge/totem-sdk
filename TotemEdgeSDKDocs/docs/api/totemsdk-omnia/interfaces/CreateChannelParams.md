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

### fundingWitnessBytes?

> `optional` **fundingWitnessBytes?**: `Uint8Array`\<`ArrayBufferLike`\>

Serialized Minima witness for the funding transaction input(s). Required for createChannel broadcast.

***

### localAmount

> **localAmount**: `bigint`

***

### localParty

> **localParty**: [`ChannelParticipant`](ChannelParticipant.md)

***

### program?

> `optional` **program?**: [`ChannelProgram`](ChannelProgram.md)

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
