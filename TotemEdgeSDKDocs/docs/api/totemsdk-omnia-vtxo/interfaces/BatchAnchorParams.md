[**@totemsdk/omnia-vtxo**](../index.md)

***

[@totemsdk/omnia-vtxo](../index.md) / BatchAnchorParams

# Interface: BatchAnchorParams

## Properties

### amount

> **amount**: `bigint`

Raw on-chain amount (token base units).

***

### epoch

> **epoch**: `number`

***

### exitBlock

> **exitBlock**: `number`

Absolute block height after which holders may exit unilaterally (STATE(102)).

***

### fundingAddress

> **fundingAddress**: `string`

***

### fundingCoinId

> **fundingCoinId**: `string`

The pool's current on-chain coin (input).

***

### fundingScript

> **fundingScript**: `string`

***

### holders

> **holders**: `string`[]

Holder WOTS public-key digests (one per pool share).

***

### operatorPublicKeyDigest

> **operatorPublicKeyDigest**: `string`

***

### root

> **root**: `string`

The epoch's Merkle root (32-byte hex).

***

### shares

> **shares**: `bigint`[]

Committed share per holder (aligned with `holders`); Σ = pool capacity.

***

### tokenId

> **tokenId**: `string`
