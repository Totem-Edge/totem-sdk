[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / RunStepReceipt

# Interface: RunStepReceipt

Fields carried by a settled receipt.

## Extends

- [`SettlementReceiptFields`](SettlementReceiptFields.md)

## Properties

### actionDigest

> **actionDigest**: `string`

***

### actualConsumption?

> `optional` **actualConsumption?**: [`ActualConsumptionV1`](ActualConsumptionV1.md)

#### Inherited from

[`SettlementReceiptFields`](SettlementReceiptFields.md).[`actualConsumption`](SettlementReceiptFields.md#actualconsumption)

***

### committedAt

> **committedAt**: `number`

***

### decisionIds

> **decisionIds**: `string`[]

Authority decision ids that authorized this step.

***

### dispatchState?

> `optional` **dispatchState?**: [`DispatchState`](../type-aliases/DispatchState.md)

#### Inherited from

[`SettlementReceiptFields`](SettlementReceiptFields.md).[`dispatchState`](SettlementReceiptFields.md#dispatchstate)

***

### effects?

> `optional` **effects?**: [`StepEffects`](StepEffects.md)

Verified effects — folded into run totals on commit.

***

### evidence?

> `optional` **evidence?**: [`RunStepEvidence`](RunStepEvidence.md)

RFC-017: preparation/execution evidence recorded with this step.

***

### executionProof?

> `optional` **executionProof?**: `unknown`

***

### mandateIds

> **mandateIds**: `string`[]

Mandates that authorized this step.

***

### releasedUsage?

> `optional` **releasedUsage?**: `object`

#### amount?

> `optional` **amount?**: `string`

#### count

> **count**: `number`

#### Inherited from

[`SettlementReceiptFields`](SettlementReceiptFields.md).[`releasedUsage`](SettlementReceiptFields.md#releasedusage)

***

### reservationId

> **reservationId**: `string`

***

### reservedUsage?

> `optional` **reservedUsage?**: `object`

#### amount?

> `optional` **amount?**: `string`

#### count

> **count**: `number`

#### Inherited from

[`SettlementReceiptFields`](SettlementReceiptFields.md).[`reservedUsage`](SettlementReceiptFields.md#reservedusage)

***

### runId

> **runId**: `string`

***

### settlementId?

> `optional` **settlementId?**: `string`

#### Inherited from

[`SettlementReceiptFields`](SettlementReceiptFields.md).[`settlementId`](SettlementReceiptFields.md#settlementid)

***

### stepId

> **stepId**: `string`

***

### terminalOutcome?

> `optional` **terminalOutcome?**: [`TerminalOutcome`](../type-aliases/TerminalOutcome.md)

#### Inherited from

[`SettlementReceiptFields`](SettlementReceiptFields.md).[`terminalOutcome`](SettlementReceiptFields.md#terminaloutcome)
