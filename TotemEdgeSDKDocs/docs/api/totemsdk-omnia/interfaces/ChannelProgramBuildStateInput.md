[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / ChannelProgramBuildStateInput

# Interface: ChannelProgramBuildStateInput

## Properties

### balances

> **balances**: `Record`\<[`partyId`](../type-aliases/partyId.md), `bigint`\>

***

### channel

> **channel**: [`OmniaChannel`](OmniaChannel.md)

***

### pendingHTLCs

> **pendingHTLCs**: [`HTLCRecord`](HTLCRecord.md)[]

***

### previousState?

> `optional` **previousState?**: [`SignedChannelState`](SignedChannelState.md) \| `null`

***

### sequence

> **sequence**: `number`

***

### settlement

> **settlement**: `boolean`

***

### transition?

> `optional` **transition?**: [`ProgramTransition`](ProgramTransition.md)
