[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / authDigest

# Function: authDigest()

> **authDigest**(`msg`, `nonce`, `expiresAt`): `Uint8Array`

Digest of the authenticated portion of a message: everything except `auth`,
the optional `ticket` reference, and the legacy `sig`, plus the anti-replay
nonce and expiry.

## Parameters

### msg

`Omit`\<[`LookupMessage`](../type-aliases/LookupMessage.md), `"auth"` \| `"ticket"` \| `"sig"`\>

### nonce

`number`

### expiresAt

`number`

## Returns

`Uint8Array`
