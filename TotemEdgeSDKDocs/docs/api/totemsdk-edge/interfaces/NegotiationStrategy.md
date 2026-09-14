[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / NegotiationStrategy

# Interface: NegotiationStrategy

Applications supply bargaining intelligence. The core SDK supplies
protocol mechanics only — no LLM, no private reservation price.

## Methods

### evaluate()

> **evaluate**(`context`): `Promise`\<\{ `action`: `"accept"`; \} \| \{ `action`: `"reject"`; `reason?`: `string`; \} \| \{ `action`: `"counter"`; `terms`: [`TradeTerms`](TradeTerms.md); \}\>

#### Parameters

##### context

###### history

[`TradeProposal`](TradeProposal.md)[]

###### negotiationId

`string`

###### proposal

[`TradeProposal`](TradeProposal.md)

###### termsHashes

`string`[]

Canonical terms hashes of all prior proposals (for cycle detection).

#### Returns

`Promise`\<\{ `action`: `"accept"`; \} \| \{ `action`: `"reject"`; `reason?`: `string`; \} \| \{ `action`: `"counter"`; `terms`: [`TradeTerms`](TradeTerms.md); \}\>
