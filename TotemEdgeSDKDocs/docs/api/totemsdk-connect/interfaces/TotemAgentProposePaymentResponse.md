[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / TotemAgentProposePaymentResponse

# Interface: TotemAgentProposePaymentResponse

## Properties

### error?

> `optional` **error?**: `string`

***

### errorCode?

> `optional` **errorCode?**: `string`

***

### proposalId?

> `optional` **proposalId?**: `string`

***

### receipt?

> `optional` **receipt?**: `object`

Populated when approved — the receipt for the executed intent.

#### channelState?

> `optional` **channelState?**: `string`

#### proposalId

> **proposalId**: `string`

#### rejectionReason?

> `optional` **rejectionReason?**: `string`

#### settledAt?

> `optional` **settledAt?**: `number`

#### status

> **status**: `"approved"` \| `"rejected"` \| `"pending_user"`

#### txpowId?

> `optional` **txpowId?**: `string`

***

### rejectionReason?

> `optional` **rejectionReason?**: `string`

***

### status?

> `optional` **status?**: `"approved"` \| `"rejected"` \| `"pending_user"`

***

### success

> **success**: `boolean`
