[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / messageId

# Function: messageId()

> **messageId**(`msg`): `string`

Compute the canonical message ID for a state-changing message.

Binds: protocol version, message type, negotiationId, proposalId /
parentProposalId where relevant, sender, recipient, timestamp, and payload
hash. The ID is recomputed deterministically — never trusted from the wire.

## Parameters

### msg

[`NegotiationMessage`](../type-aliases/NegotiationMessage.md)

## Returns

`string`
