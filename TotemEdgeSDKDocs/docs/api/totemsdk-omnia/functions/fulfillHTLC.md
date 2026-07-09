[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / fulfillHTLC

# Function: fulfillHTLC()

> **fulfillHTLC**(`channel`, `htlcId`, `preimage`, `leaseProvider`, `signer?`): `Promise`\<\{ `channel`: [`OmniaChannel`](../interfaces/OmniaChannel.md); `error?`: `string`; `partialState`: `Partial`\<[`SignedChannelState`](../interfaces/SignedChannelState.md)\>; \}\>

Recipient reveals preimage; HTLC amount moves to recipient balance in new state.

Spec: `fulfillHTLC(channel, htlcId, preimage, leaseProvider)` — signer optional.

## Parameters

### channel

[`OmniaChannel`](../interfaces/OmniaChannel.md)

### htlcId

`string`

### preimage

`string`

### leaseProvider

`WotsLeaseProvider`

### signer?

[`ChannelSigner`](../interfaces/ChannelSigner.md)

## Returns

`Promise`\<\{ `channel`: [`OmniaChannel`](../interfaces/OmniaChannel.md); `error?`: `string`; `partialState`: `Partial`\<[`SignedChannelState`](../interfaces/SignedChannelState.md)\>; \}\>
