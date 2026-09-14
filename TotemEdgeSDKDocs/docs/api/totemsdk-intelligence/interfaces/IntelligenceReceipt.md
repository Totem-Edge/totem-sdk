[**@totemsdk/intelligence**](../index.md)

***

[@totemsdk/intelligence](../index.md) / IntelligenceReceipt

# Interface: IntelligenceReceipt

Receipt for an executed inference operation.

v1 receipts are unsigned advisories produced by the provider adapter.
WOTS-signed inference receipts are a documented follow-up in the wallet/
authority layer (`signedBy` anticipates that attestation).

## Properties

### domain

> `readonly` **domain**: [`IntelligenceDomainOrString`](../type-aliases/IntelligenceDomainOrString.md)

***

### issuedAt

> `readonly` **issuedAt**: `number`

***

### model?

> `readonly` `optional` **model?**: `string`

***

### op

> `readonly` **op**: `string`

***

### proposalId?

> `readonly` `optional` **proposalId?**: `string`

***

### provider

> `readonly` **provider**: `string`

***

### receiptId

> `readonly` **receiptId**: `string`

***

### requestId

> `readonly` **requestId**: `string`

***

### runId?

> `readonly` `optional` **runId?**: `string`

***

### signedBy?

> `readonly` `optional` **signedBy?**: `string`

***

### usage

> `readonly` **usage**: `object`

#### durationMs

> `readonly` **durationMs**: `number`

#### tokensIn

> `readonly` **tokensIn**: `number`

#### tokensOut

> `readonly` **tokensOut**: `number`
