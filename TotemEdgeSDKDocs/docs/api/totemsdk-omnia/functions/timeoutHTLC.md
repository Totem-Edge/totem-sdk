[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / timeoutHTLC

# Function: timeoutHTLC()

> **timeoutHTLC**(`channel`, `htlcId`, `leaseProvider`, `currentBlock?`, `signer?`): `Promise`\<\{ `channel`: [`OmniaChannel`](../interfaces/OmniaChannel.md); `error?`: `string`; `partialState`: `Partial`\<[`SignedChannelState`](../interfaces/SignedChannelState.md)\>; \}\>

After `timeoutBlock`, HTLC amount returns to sender balance in new state.

Spec: `timeoutHTLC(channel, htlcId, leaseProvider)` — currentBlock and signer are optional.

## Parameters

### channel

[`OmniaChannel`](../interfaces/OmniaChannel.md)

### htlcId

`string`

### leaseProvider

`WotsLeaseProvider`

### currentBlock?

`bigint`

### signer?

[`ChannelSigner`](../interfaces/ChannelSigner.md)

## Returns

`Promise`\<\{ `channel`: [`OmniaChannel`](../interfaces/OmniaChannel.md); `error?`: `string`; `partialState`: `Partial`\<[`SignedChannelState`](../interfaces/SignedChannelState.md)\>; \}\>
