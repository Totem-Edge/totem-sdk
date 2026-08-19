[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / TotemAgentProposePaymentRequest

# Interface: TotemAgentProposePaymentRequest

## Properties

### method

> **method**: `"totem_agentProposePayment"`

***

### params

> **params**: `object`

#### agentId

> **agentId**: `string`

Agent identifier — opaque string chosen by the agent.

#### confidence?

> `optional` **confidence?**: `number`

Agent's confidence (0–1).

#### explanation

> **explanation**: `string`

Human-readable explanation shown to the user.

#### intent

> **intent**: `object`

The intent this proposal wants executed.

##### intent.amount?

> `optional` **amount?**: `string`

##### intent.metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

##### intent.reason?

> `optional` **reason?**: `string`

##### intent.recipient?

> `optional` **recipient?**: `string`

##### intent.risk?

> `optional` **risk?**: `"low"` \| `"medium"` \| `"high"`

##### intent.tokenId?

> `optional` **tokenId?**: `string`

##### intent.type

> **type**: `"payment"` \| `"channel_update"` \| `"settlement"` \| `"lookup"` \| `"receipt"`

#### origin

> **origin**: `string`
