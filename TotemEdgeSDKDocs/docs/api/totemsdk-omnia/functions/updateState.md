[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / updateState

# Function: updateState()

> **updateState**(`channel`, `delta`, `leaseProvider`, `signer?`): `Promise`\<[`UpdateStateResult`](../interfaces/UpdateStateResult.md)\>

Produce a new partial SignedChannelState with incremented sequence.

Spec: `updateState(channel, delta, leaseProvider)` — signer is optional and
falls back to `channel.localSigner` when not provided.

## Parameters

### channel

[`OmniaChannel`](../interfaces/OmniaChannel.md)

Current channel state (must be 'active').

### delta

[`UpdateDelta`](../interfaces/UpdateDelta.md)

Balance delta: `{ newBalances, memo? }`.

### leaseProvider

`WotsLeaseProvider`

WOTS lease provider for key slot management.

### signer?

[`ChannelSigner`](../interfaces/ChannelSigner.md)

Optional explicit signer; falls back to channel.localSigner.

## Returns

`Promise`\<[`UpdateStateResult`](../interfaces/UpdateStateResult.md)\>
