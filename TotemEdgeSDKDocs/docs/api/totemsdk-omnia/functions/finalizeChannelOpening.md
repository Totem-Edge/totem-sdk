[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / finalizeChannelOpening

# Function: finalizeChannelOpening()

> **finalizeChannelOpening**(`plan`, `opts`, `chainProvider`): `Promise`\<\{ `channel`: [`OmniaChannel`](../interfaces/OmniaChannel.md); `fundingTxId`: `string`; `proposal`: [`ChannelProposal`](../interfaces/ChannelProposal.md); \}\>

Broadcast a built channel opening using either a caller-supplied witness or
a wallet signature over the funding digest plus input proofs. Revalidates
the funding coin before the irreversible broadcast.

## Parameters

### plan

[`ChannelOpeningPlan`](../interfaces/ChannelOpeningPlan.md)

### opts

[`FinalizeChannelOpeningOptions`](../interfaces/FinalizeChannelOpeningOptions.md)

### chainProvider

`ChainStateProvider`

## Returns

`Promise`\<\{ `channel`: [`OmniaChannel`](../interfaces/OmniaChannel.md); `fundingTxId`: `string`; `proposal`: [`ChannelProposal`](../interfaces/ChannelProposal.md); \}\>
