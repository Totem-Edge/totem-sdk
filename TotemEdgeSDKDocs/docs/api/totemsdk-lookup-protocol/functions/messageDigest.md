[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / messageDigest

# Function: messageDigest()

> **messageDigest**(`msg`): `Uint8Array`

Compute a canonical digest over the message for signing/verification.
Excludes the `sig` field so the digest is stable.

## Parameters

### msg

[`LookupMessage`](../type-aliases/LookupMessage.md)

## Returns

`Uint8Array`
