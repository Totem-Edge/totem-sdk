[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / verifyPartialClosePackage

# Function: verifyPartialClosePackage()

> **verifyPartialClosePackage**(`channel`, `state`): `object`

Verify close-package artifacts before adding this node's co-signature.

This accepts packages that are incomplete for unsigned parties, but every
party already present in `state.signatures` must also have matching update
and settlement close-artifact signatures. Use `verifyClosePackage()` after
both parties have signed the final state.

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
