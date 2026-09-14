[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / HtlcFulfillmentReceipt

# Interface: HtlcFulfillmentReceipt

A verifiable fee-provenance record for a fulfilled HTLC (#27): the exact
artifact a pool's `recordPoolFee` earn-proof consumes. It binds the channel,
the HTLC, the recipient, and the amount so a fee record can be traced to a
real fulfilled payment — never a declared string.

## Properties

### amount

> **amount**: `bigint`

***

### channelId

> **channelId**: `string`

***

### fulfilledAt

> **fulfilledAt**: `number`

***

### htlcId

> **htlcId**: `string`

***

### receiptHash

> **receiptHash**: `string`

***

### recipientPublicKeyDigest

> **recipientPublicKeyDigest**: `string`

***

### sequence

> **sequence**: `number`

***

### tokenId

> **tokenId**: `string`
