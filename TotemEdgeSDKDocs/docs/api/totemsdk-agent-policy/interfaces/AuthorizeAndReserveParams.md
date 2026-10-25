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

> `optional` **evidence?**: [`RunStepEvidence`](RunStepEvidence.md)

Evidence captured during preparation; recorded on the run step receipt.

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
