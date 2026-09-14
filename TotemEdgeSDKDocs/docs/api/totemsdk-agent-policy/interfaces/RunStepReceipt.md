[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / RunStepReceipt

# Interface: RunStepReceipt

## Properties

### actionDigest

> **actionDigest**: `string`

***

### committedAt

> **committedAt**: `number`

***

### decisionIds

> **decisionIds**: `string`[]

Authority decision ids that authorized this step.

***

### effects?

> `optional` **effects?**: [`StepEffects`](StepEffects.md)

Verified effects — folded into run totals on commit.

***

### executionProof?

> `optional` **executionProof?**: `unknown`

***

### mandateIds

> **mandateIds**: `string`[]

Mandates that authorized this step.

***

### reservationId

> **reservationId**: `string`

***

### runId

> **runId**: `string`

***

### stepId

> **stepId**: `string`
