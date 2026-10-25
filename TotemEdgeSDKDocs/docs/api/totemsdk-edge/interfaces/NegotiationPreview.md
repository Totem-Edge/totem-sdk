[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / NegotiationPreview

# Interface: NegotiationPreview

RFC-019 P1-2: a negotiation run to the decision point, WITHOUT signing a
binding acceptance. A governed action authorizes the terms, then
`finalizeNegotiation()` signs the acceptance.

## Properties

### history

> **history**: [`TradeProposal`](TradeProposal.md)[]

***

### negotiationId

> **negotiationId**: `string`

***

### proposal

> **proposal**: [`TradeProposal`](TradeProposal.md)

The proposal we would accept.

***

### sellerAddress

> **sellerAddress**: `string`
