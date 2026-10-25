[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / SignedFundingIntent

# Interface: SignedFundingIntent

RFC-016 P5: a **signed funding intent** — it proves the LP signed these
claims, but NOT that an on-chain transaction spent `fundingCoinId` into the
pool. Acceptance must be accompanied by independently verified on-chain spend
evidence. Formerly named `DeepFundingProof`, which overclaimed.

## Properties

### amount

> **amount**: `string`

***

### expiresAt

> **expiresAt**: `number`

RFC-020 P2-11: mirrors `PoolFundTx.expiresAt`.

***

### fundingCoinId

> **fundingCoinId**: `string`

***

### lpAddress

> **lpAddress**: `string`

***

### lpPkDigest

> **lpPkDigest**: `string`

***

### lpSignature

> **lpSignature**: `string`

***

### nonce

> **nonce**: `string`

***

### recipientAddress

> **recipientAddress**: `string`

***

### signedDigest

> **signedDigest**: `string`

***

### tokenId

> **tokenId**: `string`
