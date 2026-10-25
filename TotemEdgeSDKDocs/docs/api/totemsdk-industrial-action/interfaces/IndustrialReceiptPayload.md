[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / IndustrialReceiptPayload

# Interface: IndustrialReceiptPayload

## Extends

- [`IndustrialReceiptFields`](IndustrialReceiptFields.md)

## Properties

### attempts

> **attempts**: `number`

#### Inherited from

[`IndustrialReceiptFields`](IndustrialReceiptFields.md).[`attempts`](IndustrialReceiptFields.md#attempts)

***

### authorityBinding

> **authorityBinding**: `string`

#### Inherited from

[`IndustrialReceiptFields`](IndustrialReceiptFields.md).[`authorityBinding`](IndustrialReceiptFields.md#authoritybinding)

***

### commitmentHash

> **commitmentHash**: `string`

#### Inherited from

[`IndustrialReceiptFields`](IndustrialReceiptFields.md).[`commitmentHash`](IndustrialReceiptFields.md#commitmenthash)

***

### completedAt?

> `optional` **completedAt?**: `number`

#### Inherited from

[`IndustrialReceiptFields`](IndustrialReceiptFields.md).[`completedAt`](IndustrialReceiptFields.md#completedat)

***

### decisionId?

> `optional` **decisionId?**: `string`

Authority/organization decision id (folded into authorityBinding).

#### Inherited from

[`IndustrialReceiptFields`](IndustrialReceiptFields.md).[`decisionId`](IndustrialReceiptFields.md#decisionid)

***

### effects?

> `optional` **effects?**: `StepEffects`

#### Inherited from

[`IndustrialReceiptFields`](IndustrialReceiptFields.md).[`effects`](IndustrialReceiptFields.md#effects)

***

### error?

> `optional` **error?**: [`ActionError`](ActionError.md)

#### Inherited from

[`IndustrialReceiptFields`](IndustrialReceiptFields.md).[`error`](IndustrialReceiptFields.md#error)

***

### failureMode

> **failureMode**: [`FailureMode`](../type-aliases/FailureMode.md)

#### Inherited from

[`IndustrialReceiptFields`](IndustrialReceiptFields.md).[`failureMode`](IndustrialReceiptFields.md#failuremode)

***

### integrity

> **integrity**: `string`

***

### kind

> **kind**: `string`

#### Inherited from

[`IndustrialReceiptFields`](IndustrialReceiptFields.md).[`kind`](IndustrialReceiptFields.md#kind)

***

### mandateProofId?

> `optional` **mandateProofId?**: `string`

#### Inherited from

[`IndustrialReceiptFields`](IndustrialReceiptFields.md).[`mandateProofId`](IndustrialReceiptFields.md#mandateproofid)

***

### operationId

> **operationId**: `string`

#### Inherited from

[`IndustrialReceiptFields`](IndustrialReceiptFields.md).[`operationId`](IndustrialReceiptFields.md#operationid)

***

### outcome

> **outcome**: [`ActionOutcome`](../type-aliases/ActionOutcome.md)

#### Inherited from

[`IndustrialReceiptFields`](IndustrialReceiptFields.md).[`outcome`](IndustrialReceiptFields.md#outcome)

***

### proposalId?

> `optional` **proposalId?**: `string`

#### Inherited from

[`IndustrialReceiptFields`](IndustrialReceiptFields.md).[`proposalId`](IndustrialReceiptFields.md#proposalid)

***

### resourceId?

> `optional` **resourceId?**: `string`

#### Inherited from

[`IndustrialReceiptFields`](IndustrialReceiptFields.md).[`resourceId`](IndustrialReceiptFields.md#resourceid)

***

### rollback?

> `optional` **rollback?**: `boolean`

#### Inherited from

[`IndustrialReceiptFields`](IndustrialReceiptFields.md).[`rollback`](IndustrialReceiptFields.md#rollback)

***

### schema

> **schema**: `"totem:industrial:receipt/v1"`

***

### semanticDecisionId?

> `optional` **semanticDecisionId?**: `string`

RFC-017: the semantic DecisionReceipt.receiptId that motivated this action.
Distinct from `decisionId` (authority); grants nothing and is NOT part of
the authority binding.

#### Inherited from

[`IndustrialReceiptFields`](IndustrialReceiptFields.md).[`semanticDecisionId`](IndustrialReceiptFields.md#semanticdecisionid)

***

### startedAt?

> `optional` **startedAt?**: `number`

#### Inherited from

[`IndustrialReceiptFields`](IndustrialReceiptFields.md).[`startedAt`](IndustrialReceiptFields.md#startedat)
