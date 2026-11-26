[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / verifyStateWithRustMirror

# Function: verifyStateWithRustMirror()

> **verifyStateWithRustMirror**(`channel`, `state`): `object`

Verify a signed channel state with the Rust mirror.

Returns `{ valid: false }` when the mirror is unavailable or throws.

## Parameters

### channel

[`OmniaChannel`](../interfaces/OmniaChannel.md)

### state

[`SignedChannelState`](../interfaces/SignedChannelState.md)

## Returns

`object`

### errors

> **errors**: `string`[]

### valid

> **valid**: `boolean`
