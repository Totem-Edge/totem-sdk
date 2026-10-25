[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / SendProposalParams

# Interface: SendProposalParams

## Properties

### channelId

> **channelId**: `string`

***

### correlationId

> **correlationId**: `string`

***

### kind

> **kind**: [`CoordinationKind`](../type-aliases/CoordinationKind.md)

***

### payload

> **payload**: `unknown`

***

### peer

> **peer**: [`OmniaPeer`](OmniaPeer.md)

***

### peers?

> `optional` **peers?**: `string`[]

Pubkeys the proposal concerns (routing identity only). Defaults to `[peer.pubkey]`.
