[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / IndustrialReceiptFields

# Interface: IndustrialReceiptFields

## Extended by

- [`IndustrialReceiptPayload`](IndustrialReceiptPayload.md)

## Properties

### attempts

> **attempts**: `number`

***

### authorityBinding

> **authorityBinding**: `string`

***

### commitmentHash

> **commitmentHash**: `string`

***

### completedAt?

> `optional` **completedAt?**: `number`

***

### decisionId?

> `optional` **decisionId?**: `string`

Authority/organization decision id (folded into authorityBinding).

***

### effects?

> `optional` **effects?**: `StepEffects`

***

### error?

> `optional` **error?**: [`ActionError`](ActionError.md)

***

### failureMode

> **failureMode**: [`FailureMode`](../type-aliases/FailureMode.md)

***

### kind

> **kind**: `string`

***

### mandateProofId?

> `optional` **mandateProofId?**: `string`

***

### operationId

> **operationId**: `string`

***

### outcome

> **outcome**: [`ActionOutcome`](../type-aliases/ActionOutcome.md)

***

### proposalId?

> `optional` **proposalId?**: `string`

***

### resourceId?

> `optional` **resourceId?**: `string`

***

### rollback?

> `optional` **rollback?**: `boolean`

***

### semanticDecisionId?

> `optional` **semanticDecisionId?**: `string`

RFC-017: the semantic DecisionReceipt.receiptId that motivated this action.
Distinct from `decisionId` (authority); grants nothing and is NOT part of
the authority binding.

***

### startedAt?

> `optional` **startedAt?**: `number`
