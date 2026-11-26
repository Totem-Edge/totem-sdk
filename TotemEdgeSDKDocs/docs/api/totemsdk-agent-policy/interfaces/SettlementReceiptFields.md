[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / SettlementReceiptFields

# Interface: SettlementReceiptFields

Fields carried by a settled receipt.

## Extended by

- [`RunStepReceipt`](RunStepReceipt.md)
- [`StepReceipt`](StepReceipt.md)

## Properties

### actualConsumption?

> `optional` **actualConsumption?**: [`ActualConsumptionV1`](ActualConsumptionV1.md)

***

### dispatchState?

> `optional` **dispatchState?**: [`DispatchState`](../type-aliases/DispatchState.md)

***

### releasedUsage?

> `optional` **releasedUsage?**: `object`

#### amount?

> `optional` **amount?**: `string`

#### count

> **count**: `number`

***

### reservedUsage?

> `optional` **reservedUsage?**: `object`

#### amount?

> `optional` **amount?**: `string`

#### count

> **count**: `number`

***

### settlementId?

> `optional` **settlementId?**: `string`

***

### terminalOutcome?

> `optional` **terminalOutcome?**: [`TerminalOutcome`](../type-aliases/TerminalOutcome.md)
