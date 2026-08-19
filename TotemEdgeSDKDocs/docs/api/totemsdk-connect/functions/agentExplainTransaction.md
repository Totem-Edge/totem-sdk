[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / agentExplainTransaction

# Function: agentExplainTransaction()

> **agentExplainTransaction**(`origin`, `params`): `Promise`\<[`TotemAgentExplainTransactionResponse`](../interfaces/TotemAgentExplainTransactionResponse.md)\>

## Parameters

### origin

`string`

### params

#### context?

`Record`\<`string`, `unknown`\>

#### intent?

\{ `amount?`: `string`; `reason?`: `string`; `recipient?`: `string`; `tokenId?`: `string`; `type`: `"payment"` \| `"channel_update"` \| `"settlement"` \| `"lookup"` \| `"receipt"`; \}

#### intent.amount?

`string`

#### intent.reason?

`string`

#### intent.recipient?

`string`

#### intent.tokenId?

`string`

#### intent.type

`"payment"` \| `"channel_update"` \| `"settlement"` \| `"lookup"` \| `"receipt"`

#### txpowId?

`string`

#### unsignedHex?

`string`

## Returns

`Promise`\<[`TotemAgentExplainTransactionResponse`](../interfaces/TotemAgentExplainTransactionResponse.md)\>
