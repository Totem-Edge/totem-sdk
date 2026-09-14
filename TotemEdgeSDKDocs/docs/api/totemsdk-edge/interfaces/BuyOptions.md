[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / BuyOptions

# Interface: BuyOptions

## Properties

### acquireBy?

> `optional` **acquireBy?**: `number`

Overall acquisition deadline (independent of negotiation TTL).

***

### adapter?

> `optional` **adapter?**: [`ResourceAdapter`](ResourceAdapter.md)

Resource adapter to use for execution.

***

### context?

> `optional` **context?**: `Record`\<`string`, `unknown`\>

Execution context passed to the adapter.

***

### intent

> **intent**: [`PurchaseIntent`](PurchaseIntent.md)

***

### negotiation?

> `optional` **negotiation?**: `Partial`\<[`NegotiationLimits`](NegotiationLimits.md)\>

Negotiation limits (used only on the negotiated path).

***

### strategy?

> `optional` **strategy?**: [`NegotiationStrategy`](NegotiationStrategy.md)
