[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / acceptChannel

# Function: acceptChannel()

> **acceptChannel**(`proposal`, `provider?`): [`OmniaChannel`](../interfaces/OmniaChannel.md)

Bob's side: validates an inbound channel proposal and returns an active channel.
Recomputes the script from the proposal's parties and validates it matches the
claimed fundingScript (tampering detection).

## Parameters

### proposal

[`ChannelProposal`](../interfaces/ChannelProposal.md)

Inbound channel proposal from the initiating party.

### provider?

`ChainStateProvider`

Optional chain provider for on-chain funding TX validation.

## Returns

[`OmniaChannel`](../interfaces/OmniaChannel.md)
