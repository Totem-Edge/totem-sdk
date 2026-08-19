[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / EdgePolicyPort

# Interface: EdgePolicyPort

## Methods

### check()

> **check**(`params`): `Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `allowed`: `boolean`; `reason?`: `string`; \}\>\>

#### Parameters

##### params

###### action

`string`

###### context?

`Record`\<`string`, `unknown`\>

###### proposal?

\{ `agentId`: `string`; `confidence`: `number`; `createdAt`: `number`; `explanation`: `string`; `id`: `string`; `intent`: \{ `amount?`: `string`; `reason?`: `string`; `recipient?`: `string`; `risk?`: `string`; `tokenId?`: `string`; `type`: `string`; \}; \}

Full agent proposal (when available — richer than flat action/subject).

###### proposal.agentId

`string`

###### proposal.confidence

`number`

###### proposal.createdAt

`number`

###### proposal.explanation

`string`

###### proposal.id

`string`

###### proposal.intent

\{ `amount?`: `string`; `reason?`: `string`; `recipient?`: `string`; `risk?`: `string`; `tokenId?`: `string`; `type`: `string`; \}

###### proposal.intent.amount?

`string`

###### proposal.intent.reason?

`string`

###### proposal.intent.recipient?

`string`

###### proposal.intent.risk?

`string`

###### proposal.intent.tokenId?

`string`

###### proposal.intent.type

`string`

###### subject

`string`

#### Returns

`Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `allowed`: `boolean`; `reason?`: `string`; \}\>\>
