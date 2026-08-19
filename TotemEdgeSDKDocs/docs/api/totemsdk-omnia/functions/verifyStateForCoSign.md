[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / verifyStateForCoSign

# Function: verifyStateForCoSign()

> **verifyStateForCoSign**(`channel`, `state`): `Promise`\<\{ `errors`: `string`[]; `valid`: `boolean`; \}\>

Validate a one-party state update before this node adds its co-signature.

This performs the sequence, conservation, V2 commitment, program-hook,
partial close-package, and present-signature checks needed by the co-sign
path. It intentionally does not require every channel party to have signed.
After co-signing and merging, use `verifyState()` on the completed state.

## Parameters

### channel

[`OmniaChannel`](../interfaces/OmniaChannel.md)

### state

[`SignedChannelState`](../interfaces/SignedChannelState.md)

## Returns

`Promise`\<\{ `errors`: `string`[]; `valid`: `boolean`; \}\>
