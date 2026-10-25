[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / IndustrialExecutionResult

# Interface: IndustrialExecutionResult\<TResult\>

Industrial execution result — `EdgeOperationResult` plus the outcome model.

## Extends

- `EdgeOperationResult`\<`TResult`\>

## Type Parameters

### TResult

`TResult` = `unknown`

## Properties

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

### outcome

> **outcome**: [`ActionOutcome`](../type-aliases/ActionOutcome.md)

***

### receipt?

> `optional` **receipt?**: `EdgeReceipt`

Authority-bound evidence (RFC-010 §6.7).

***

### safeStateApplied?

> `optional` **safeStateApplied?**: `boolean`
