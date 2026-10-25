[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / SignRequest

# Interface: SignRequest

## Properties

### chainId?

> `optional` **chainId?**: `string`

***

### context

> **context**: [`SignContext`](SignContext.md)

***

### custody

> **custody**: [`CustodyContext`](CustodyContext.md)

***

### digest

> **digest**: `Uint8Array`

The canonical payload digest to sign (before domain separation).

***

### domain

> **domain**: [`SignDomain`](../type-aliases/SignDomain.md)

***

### expiresAt?

> `optional` **expiresAt?**: `number`

***

### kind?

> `optional` **kind?**: `SignRequestKind`

Defaults to `intent`.

***

### requestId

> **requestId**: `string`

Idempotency key; reusing it with a different payload is rejected.

***

### signers

> **signers**: `string`[]

Required signer public-key digests.

***

### signingIndices?

> `optional` **signingIndices?**: `SigningIndices`

Pre-reserved lease indices. When supplied, the signer must use them and the
caller owns reserve/commit (used by channel/factory tx signing).
