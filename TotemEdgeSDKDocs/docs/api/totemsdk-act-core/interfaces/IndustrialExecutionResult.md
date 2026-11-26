[**@totemsdk/act-core**](../index.md)

***

[@totemsdk/act-core](../index.md) / IndustrialExecutionResult

# Interface: IndustrialExecutionResult\<TResult\>

Industrial execution result — `EdgeOperationResult` plus the outcome model.

## Extends

- `EdgeOperationResult`\<`TResult`\>

## Type Parameters

### TResult

`TResult` = `unknown`

## Properties

### actualConsumption?

> `optional` **actualConsumption?**: `ActualConsumptionV1`

***

### attempts

> **attempts**: `number`

***

### data?

> `optional` **data?**: `TResult`

#### Inherited from

`EdgeOperationResult.data`

***

### deduplicated?

> `optional` **deduplicated?**: `boolean`

True when the result was served from an existing durable record (dedup).

***

### dispatchState?

> `optional` **dispatchState?**: `DispatchState`

RFC-022 Amendment A: did the operation reach the device?

***

### error?

> `optional` **error?**: `string`

#### Inherited from

`EdgeOperationResult.error`

***

### errorCode?

> `optional` **errorCode?**: `string`

#### Inherited from

`EdgeOperationResult.errorCode`

***

### failureMode

> **failureMode**: [`FailureMode`](../type-aliases/FailureMode.md)

***

### ok

> **ok**: `boolean`

#### Inherited from

`EdgeOperationResult.ok`

***

### operationId?

> `optional` **operationId?**: `string`

***

### outcome

> **outcome**: [`ActionOutcome`](../type-aliases/ActionOutcome.md)

***

### phase?

> `optional` **phase?**: `NonterminalPhase`

Non-terminal phase when the controller accepted but has not finished.

***

### receipt?

> `optional` **receipt?**: `EdgeReceipt`

Authority-bound evidence (RFC-010 §6.7).

***

### safeStateApplied?

> `optional` **safeStateApplied?**: `boolean`

***

### terminalOutcome?

> `optional` **terminalOutcome?**: `TerminalOutcome`
