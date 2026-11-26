[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / StepReceipt

# Interface: StepReceipt

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

### dispatchState?

> `optional` **dispatchState?**: [`DispatchState`](../type-aliases/DispatchState.md)

#### Inherited from

[`SettlementReceiptFields`](SettlementReceiptFields.md).[`dispatchState`](SettlementReceiptFields.md#dispatchstate)

***

### executionProof?

> `optional` **executionProof?**: `unknown`

***

### mandateId

> **mandateId**: `string`

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
