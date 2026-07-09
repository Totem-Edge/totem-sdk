[**@totemsdk/manifest**](../index.md)

***

[@totemsdk/manifest](../index.md) / SignedManifest

# Interface: SignedManifest\<T\>

Wraps any manifest with a WOTS signature.

`signerPublicKey` — hex of the full WOTS public key (required for
self-contained verification via verifyManifest).
`authorAddress`  — the Minima address of the signer, derived at sign time
  and stored for quick policy checks without re-deriving from the public key.

## Type Parameters

### T

`T` *extends* [`Manifest`](../type-aliases/Manifest.md) = [`Manifest`](../type-aliases/Manifest.md)

## Properties

### authorAddress

> **authorAddress**: `string`

***

### manifest

> **manifest**: `T`

***

### rootIdentityProof?

> `optional` **rootIdentityProof?**: `string`

***

### signature

> **signature**: `string`

***

### signedAt

> **signedAt**: `number`

***

### signerPublicKey

> **signerPublicKey**: `string`
