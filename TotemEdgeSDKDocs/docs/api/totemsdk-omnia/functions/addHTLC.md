[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / addHTLC

# Function: addHTLC()

> **addHTLC**(`channel`, `params`, `leaseProvider`, `signer?`): `Promise`\<\{ `channel`: [`OmniaChannel`](../interfaces/OmniaChannel.md); `error?`: `string`; `htlcId`: `string`; `partialState`: `Partial`\<[`SignedChannelState`](../interfaces/SignedChannelState.md)\>; \}\>

Adds a Hash Time-Locked Contract as a conditional output in the next state update.

Spec: `addHTLC(channel, htlcParams, leaseProvider)` — signer is optional, falls back
to `channel.localSigner`.

## Parameters

### channel

[`OmniaChannel`](../interfaces/OmniaChannel.md)

### params

[`AddHTLCParams`](../interfaces/AddHTLCParams.md)

### leaseProvider

`WotsLeaseProvider`

### signer?

[`ChannelSigner`](../interfaces/ChannelSigner.md)

## Returns

`Promise`\<\{ `channel`: [`OmniaChannel`](../interfaces/OmniaChannel.md); `error?`: `string`; `htlcId`: `string`; `partialState`: `Partial`\<[`SignedChannelState`](../interfaces/SignedChannelState.md)\>; \}\>
