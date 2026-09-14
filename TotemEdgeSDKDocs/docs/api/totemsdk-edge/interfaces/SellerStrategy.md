[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / SellerStrategy

# Interface: SellerStrategy

Applications supply seller-side bargaining intelligence.

The input proposal is the *current head from the buyer's perspective*.
The seller may accept it, reject it, or counter with new terms.

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

#### Returns

`Promise`\<\{ `action`: `"accept"`; \} \| \{ `action`: `"reject"`; `reason?`: `string`; \} \| \{ `action`: `"counter"`; `terms`: [`TradeTerms`](TradeTerms.md); \}\>
