[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / timeoutHTLC

# Function: timeoutHTLC()

> **timeoutHTLC**(`channel`, `htlcId`, `leaseProvider`, `chainProvider`, `signer?`): `Promise`\<\{ `channel`: [`OmniaChannel`](../interfaces/OmniaChannel.md); `error?`: `string`; `partialState`: `Partial`\<[`SignedChannelState`](../interfaces/SignedChannelState.md)\>; \}\>

After `timeoutBlock`, HTLC amount returns to sender balance in new state.

Spec: `timeoutHTLC(channel, htlcId, leaseProvider, chainProvider)` — signer is optional.
The current block height is fetched from `chainProvider.getTip()` — the caller
cannot supply an untrusted height. This prevents premature timeout attacks.

## Parameters

### channel

[`OmniaChannel`](../interfaces/OmniaChannel.md)

### htlcId

`string`

### leaseProvider

`WotsLeaseProvider`

### chainProvider

`ChainStateProvider`

### signer?

[`ChannelSigner`](../interfaces/ChannelSigner.md)

## Returns

`Promise`\<\{ `channel`: [`OmniaChannel`](../interfaces/OmniaChannel.md); `error?`: `string`; `partialState`: `Partial`\<[`SignedChannelState`](../interfaces/SignedChannelState.md)\>; \}\>
