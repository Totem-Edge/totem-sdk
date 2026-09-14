[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / verifyRegistryRootInState

# Function: verifyRegistryRootInState()

> **verifyRegistryRootInState**(`state`, `expectedRoot`): `object`

Verify that a signed channel state announces the expected registry root.
Returns the failure reason when the root is missing or mismatched.

## Parameters

### state

[`SignedChannelState`](../interfaces/SignedChannelState.md)

### expectedRoot

`string`

## Returns

`object`

### error?

> `optional` **error?**: `string`

### valid

> **valid**: `boolean`
