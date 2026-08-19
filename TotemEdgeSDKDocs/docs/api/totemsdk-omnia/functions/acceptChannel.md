[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / acceptChannel

# Function: acceptChannel()

> **acceptChannel**(`proposal`, `provider?`, `minConfirmations?`): `Promise`\<[`OmniaChannel`](../interfaces/OmniaChannel.md)\>

Bob's side: validates an inbound channel proposal and returns a channel.

If a chain provider is supplied, the funding coin is verified on-chain.
The channel is returned with status 'funding_pending' — call
`activateChannel()` after the funding transaction reaches the required
confirmation depth.

## Parameters

### proposal

[`ChannelProposal`](../interfaces/ChannelProposal.md)

Inbound channel proposal from the initiating party.

### provider?

`ChainStateProvider`

Optional chain provider for on-chain funding TX validation.

### minConfirmations?

`number` = `1`

Minimum confirmations required (default 1).

## Returns

`Promise`\<[`OmniaChannel`](../interfaces/OmniaChannel.md)\>
