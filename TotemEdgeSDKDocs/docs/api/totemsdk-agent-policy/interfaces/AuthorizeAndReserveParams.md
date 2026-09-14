[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / AuthorizeAndReserveParams

# Interface: AuthorizeAndReserveParams

## Properties

### action

> **action**: [`CanonicalAgentAction`](CanonicalAgentAction.md)

The PREPARED operation reduced to canonical security facts.

***

### evidence?

> `optional` **evidence?**: `object`

#### executionReceipt?

> `optional` **executionReceipt?**: `unknown`

#### postconditionsVerified?

> `optional` **postconditionsVerified?**: `boolean`

#### quoteTimestamp?

> `optional` **quoteTimestamp?**: `number`

#### simulation?

> `optional` **simulation?**: `unknown`

***

### nonce

> **nonce**: `string`

Must be unique per run (anti-replay of a prepared step).

***

### runId

> **runId**: `string`

***

### stepId

> **stepId**: `string`
