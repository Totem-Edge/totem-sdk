[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / verifyChannelSignature

# Function: verifyChannelSignature()

> **verifyChannelSignature**(`signature`, `digest`, `publicKeyDigest`): `boolean`

Verify a channel signature over `digest` for the party whose WOTS
`publicKeyDigest` (64 hex chars, tree-root public key) is given. Fails closed
on any error.

## Parameters

### signature

[`ChannelSignature`](../type-aliases/ChannelSignature.md)

### digest

`Uint8Array`

### publicKeyDigest

`string`

## Returns

`boolean`
