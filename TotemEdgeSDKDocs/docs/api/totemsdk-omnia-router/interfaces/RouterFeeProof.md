[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / RouterFeeProof

# Interface: RouterFeeProof

A verifiable fee-provenance record for a settled hop (#29): the artifact a
pool's `recordPoolFee` earn-proof consumes. Binds channel + HTLC + recipient
+ amount so a fee record traces to a real fulfilled payment.

## Properties

### amount

> **amount**: `bigint`

***

### channelId

> **channelId**: `string`

***

### htlcId

> **htlcId**: `string`

***

### proofHash

> **proofHash**: `string`

***

### recipientPublicKeyDigest

> **recipientPublicKeyDigest**: `string`

***

### settledAt

> **settledAt**: `number`

***

### tokenId

> **tokenId**: `string`
