[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / RouterChannel

# Interface: RouterChannel

Minimal mirror of OmniaChannel — the fields the router actually reads.
Structurally compatible with @totemsdk/omnia's OmniaChannel so callers
can pass real channel objects without an adapter.

## Properties

### balances

> **balances**: `Record`\<`string`, `bigint`\>

***

### channelId

> **channelId**: `string`

***

### currentSequence

> **currentSequence**: `number`

***

### localSigner?

> `optional` **localSigner?**: [`ChannelSigner`](ChannelSigner.md)

***

### parties

> **parties**: [`ChannelParty`](ChannelParty.md)[]

***

### pendingHTLCs

> **pendingHTLCs**: [`ChannelHTLC`](ChannelHTLC.md)[]

***

### status

> **status**: `string`

***

### tokenId

> **tokenId**: `string`

***

### totalValue

> **totalValue**: `bigint`
