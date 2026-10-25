[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / GovernedCommerceConfig

# Interface: GovernedCommerceConfig

## Properties

### buyer

> **buyer**: [`EdgeBuyer`](../classes/EdgeBuyer.md)

The trusted-host buyer. Held privately by the governed action definitions.

***

### negotiation?

> `optional` **negotiation?**: `Partial`\<[`NegotiationLimits`](NegotiationLimits.md)\>

Default negotiation limits.

***

### strategy?

> `optional` **strategy?**: [`NegotiationStrategy`](NegotiationStrategy.md)

Default negotiation strategy for the negotiated purchase path.
