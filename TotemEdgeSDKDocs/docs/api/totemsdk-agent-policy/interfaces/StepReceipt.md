[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / StepReceipt

# Interface: StepReceipt

## Properties

### actionDigest

> **actionDigest**: `string`

***

### committedAt

> **committedAt**: `number`

***

### executionProof?

> `optional` **executionProof?**: `unknown`

***

### mandateId

> **mandateId**: `string`

***

### reservationId

> **reservationId**: `string`

***

### runId

> **runId**: `string`

***

### stepId

> **stepId**: `string`

***

### usageDelta?

> `optional` **usageDelta?**: `object`

The exact usage reserved for this step. Persisted so committed budget
reconstructs BOTH count and amount (AUD-019) — dropping amount made
`maxTotal` unenforceable after the first commit.

#### amount?

> `optional` **amount?**: `string`

#### count

> **count**: `number`
