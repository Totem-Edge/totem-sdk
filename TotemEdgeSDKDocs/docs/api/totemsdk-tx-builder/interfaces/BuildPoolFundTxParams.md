[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / BuildPoolFundTxParams

# Interface: BuildPoolFundTxParams

## Properties

### amount

> **amount**: `string`

***

### expiresAt

> **expiresAt**: `number`

RFC-020 P2-11: absolute expiry (epoch ms) after which the intent must be
rejected. Required so an intent cannot be replayed indefinitely.

***

### fundingCoinId

> **fundingCoinId**: `string`

***

### lpAddress

> **lpAddress**: `string`

***

### lpKeyIndex

> **lpKeyIndex**: `number`

RFC-020 C1: the WOTS leaf index to sign with. Required — never defaulted —
so a caller must obtain it from a lease/watermark reservation and cannot
silently reuse leaf 0.

***

### lpSeed

> **lpSeed**: `Uint8Array`

***

### nonce?

> `optional` **nonce?**: `string`

***

### poolId

> **poolId**: `string`

***

### recipientAddress

> **recipientAddress**: `string`

***

### tokenId?

> `optional` **tokenId?**: `string`
