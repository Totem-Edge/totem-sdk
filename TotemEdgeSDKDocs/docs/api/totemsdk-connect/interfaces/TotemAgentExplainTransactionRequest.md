[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / TotemAgentExplainTransactionRequest

# Interface: TotemAgentExplainTransactionRequest

## Properties

### method

> **method**: `"totem_agentExplainTransaction"`

***

### params

> **params**: `object`

#### context?

> `optional` **context?**: `Record`\<`string`, `unknown`\>

#### intent?

> `optional` **intent?**: `object`

##### intent.amount?

> `optional` **amount?**: `string`

##### intent.reason?

> `optional` **reason?**: `string`

##### intent.recipient?

> `optional` **recipient?**: `string`

##### intent.tokenId?

> `optional` **tokenId?**: `string`

##### intent.type

> **type**: `"payment"` \| `"channel_update"` \| `"settlement"` \| `"lookup"` \| `"receipt"`

#### origin

> **origin**: `string`

#### txpowId?

> `optional` **txpowId?**: `string`

#### unsignedHex?

> `optional` **unsignedHex?**: `string`
