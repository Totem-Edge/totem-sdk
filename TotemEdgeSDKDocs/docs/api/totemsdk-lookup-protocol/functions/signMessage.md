[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / signMessage

# Function: signMessage()

> **signMessage**\<`T`\>(`msg`, `sign`, `rootPublicKey`, `options`): `Promise`\<`T`\>

Attach a WOTS auth envelope to a message. The signer signs the auth digest.
`rootPublicKey` is the hex PKdigest; `rootIdentityProof`/`address` are optional.

## Type Parameters

### T

`T` *extends* [`LookupMessage`](../type-aliases/LookupMessage.md)

## Parameters

### msg

`Omit`\<`T`, `"auth"` \| `"ticket"` \| `"sig"`\>

### sign

[`SignFn`](../interfaces/SignFn.md)

### rootPublicKey

`string`

### options

#### address?

`string`

#### expiresAt

`number`

#### nonce

`number`

#### rootIdentityProof?

`string`

## Returns

`Promise`\<`T`\>
