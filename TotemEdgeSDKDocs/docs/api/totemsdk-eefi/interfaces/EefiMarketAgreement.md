[**@totemsdk/eefi**](../index.md)

***

[@totemsdk/eefi](../index.md) / EefiMarketAgreement

# Interface: EefiMarketAgreement

A signed, finite, executable quote (RFC-050 §5).

`quoteId` is the canonical digest of the quote body excluding `quoteId` and
`signatureRef` (see `eefiMarketQuoteDigest`). `signatureRef` points at the
signed-negotiation digest (e.g. `@totemsdk/edge` TradeAgreement); it is bound
separately so the quote can be re-signed without changing its identity.

## Properties

### baseAssetId

> **baseAssetId**: `string`

***

### baseScale

> **baseScale**: `number`

***

### conditionPolicyId?

> `optional` **conditionPolicyId?**: `string`

***

### deadlineBlock

> **deadlineBlock**: `string`

Deadline block height, as a decimal string.

***

### domain

> **domain**: `string`

Chain/network domain.

***

### exactIn?

> `optional` **exactIn?**: `string`

***

### exactOut?

> `optional` **exactOut?**: `string`

***

### feesBps

> **feesBps**: `number`

Fee in basis points (0–10000).

***

### makerId

> **makerId**: `string`

***

### maxSlippageBps?

> `optional` **maxSlippageBps?**: `number`

***

### nonce

> **nonce**: `string`

***

### priceAtoms

> **priceAtoms**: `string`

Price of one base unit in quote atoms, as a decimal string.

***

### quoteAssetId

> **quoteAssetId**: `string`

***

### quoteId

> **quoteId**: `string`

***

### quoteScale

> **quoteScale**: `number`

***

### side

> **side**: [`EefiMarketSide`](../type-aliases/EefiMarketSide.md)

***

### signatureRef

> **signatureRef**: `string`

Reference to the signed-negotiation digest.

***

### takerId

> **takerId**: `string`

***

### venue

> **venue**: `string`

Venue reference (reserve / channel / HTLC plan).

***

### version

> **version**: `"eefi-market/v1"`
