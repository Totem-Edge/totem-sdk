[**@totemsdk/omnia-lsp**](../index.md)

***

[@totemsdk/omnia-lsp](../index.md) / OmniaLspOpenQuote

# Interface: OmniaLspOpenQuote

## Properties

### consumerAddress

> **consumerAddress**: `string`

***

### consumerPartyId

> **consumerPartyId**: `string`

Consumer Omnia party id (identity id or channel party id).

***

### consumerPublicKeyDigest

> **consumerPublicKeyDigest**: `string`

Consumer channel key digest (32-byte hex).

***

### consumerSettlementAddress?

> `optional` **consumerSettlementAddress?**: `string`

***

### consumerTransportPubkey?

> `optional` **consumerTransportPubkey?**: `string`

***

### expiresAt

> **expiresAt**: `number`

***

### feeBasis?

> `optional` **feeBasis?**: [`OmniaLspFeeBasis`](../type-aliases/OmniaLspFeeBasis.md)

What the percentage fees were applied to. Required on quotes issued from
OMN-072 onward; absent on pre-OMN-072 quotes, which were priced on the
consumer contribution.

***

### leaseFee?

> `optional` **leaseFee?**: `string`

***

### localAmount

> **localAmount**: `string`

Consumer side of the initial channel balance.

***

### openFee

> **openFee**: `string`

***

### providerId

> **providerId**: `string`

***

### providerPartyId

> **providerPartyId**: `string`

***

### providerPublicKeyDigest

> **providerPublicKeyDigest**: `string`

***

### providerSettlementAddress

> **providerSettlementAddress**: `string`

***

### quoteId

> **quoteId**: `string`

***

### remoteAmount

> **remoteAmount**: `string`

Provider side of the initial channel balance.

***

### signature

> **signature**: `string`

***

### termsHash

> **termsHash**: `string`

***

### tokenId

> **tokenId**: `string`

***

### version

> **version**: `"omnia-lsp/open-quote/v1"`
