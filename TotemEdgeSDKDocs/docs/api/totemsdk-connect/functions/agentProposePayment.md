[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / agentProposePayment

# Function: agentProposePayment()

> **agentProposePayment**(`origin`, `params`): `Promise`\<[`TotemAgentProposePaymentResponse`](../interfaces/TotemAgentProposePaymentResponse.md)\>

## Parameters

### origin

`string`

### params

#### agentId

`string`

#### confidence?

`number`

#### explanation

`string`

#### intent

\{ `amount?`: `string`; `metadata?`: `Record`\<`string`, `unknown`\>; `reason?`: `string`; `recipient?`: `string`; `risk?`: `"low"` \| `"medium"` \| `"high"`; `tokenId?`: `string`; `type`: `"payment"` \| `"channel_update"` \| `"settlement"` \| `"lookup"` \| `"receipt"`; \}

#### intent.amount?

`string`

#### intent.metadata?

`Record`\<`string`, `unknown`\>

#### intent.reason?

`string`

#### intent.recipient?

`string`

#### intent.risk?

`"low"` \| `"medium"` \| `"high"`

#### intent.tokenId?

`string`

#### intent.type

`"payment"` \| `"channel_update"` \| `"settlement"` \| `"lookup"` \| `"receipt"`

## Returns

`Promise`\<[`TotemAgentProposePaymentResponse`](../interfaces/TotemAgentProposePaymentResponse.md)\>
