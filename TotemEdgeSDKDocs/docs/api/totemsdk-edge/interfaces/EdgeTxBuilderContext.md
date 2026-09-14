[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / EdgeTxBuilderContext

# Interface: EdgeTxBuilderContext

Wallet-side tx building context. The wallet builds the transaction FIRST
(coin selection + outputs), then the action derives effects from the real
built tx — never from agent-supplied hints.

## Methods

### buildChannelUpdateTx()?

> `optional` **buildChannelUpdateTx**(`params`): `Promise`\<\{ `channelScriptAddress`: `string`; `draft`: \{ `inputs`: `object`[]; `outputs`: `object`[]; \}; \}\>

Build an Omnia channel update tx. Returns the draft + channel script address.

#### Parameters

##### params

###### channelId

`string`

###### newBalances

`Record`\<`string`, `string`\>

#### Returns

`Promise`\<\{ `channelScriptAddress`: `string`; `draft`: \{ `inputs`: `object`[]; `outputs`: `object`[]; \}; \}\>

***

### buildPaymentTx()?

> `optional` **buildPaymentTx**(`params`): `Promise`\<\{ `ownAddresses`: `string`[]; `params`: \{ `inputs`: `object`[]; `outputs`: `object`[]; \}; \}\>

Build an L1 payment tx (coin selection + outputs). Returns the built params.

#### Parameters

##### params

###### amount

`string`

###### memo?

`string`

###### recipient

`string`

###### tokenId?

`string`

#### Returns

`Promise`\<\{ `ownAddresses`: `string`[]; `params`: \{ `inputs`: `object`[]; `outputs`: `object`[]; \}; \}\>
