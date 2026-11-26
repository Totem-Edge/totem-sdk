[**@totemsdk/act-core**](../index.md)

***

[@totemsdk/act-core](../index.md) / DeviceOperationRecord

# Interface: DeviceOperationRecord

## Properties

### attempts

> **attempts**: `number`

***

### authorityDecisionId?

> `optional` **authorityDecisionId?**: `string`

***

### cancelRequested?

> `optional` **cancelRequested?**: `boolean`

***

### error?

> `optional` **error?**: `string`

***

### handle?

> `optional` **handle?**: `unknown`

Adapter-declared handle (mission/session/goal id) for reconciliation.

***

### invocationId?

> `optional` **invocationId?**: `string`

***

### operationId

> **operationId**: `string`

***

### outcome?

> `optional` **outcome?**: [`ActionOutcome`](../type-aliases/ActionOutcome.md)

***

### preparedCommandHash?

> `optional` **preparedCommandHash?**: `string`

RFC-022 prepared-command digest this record is bound to.

***

### progress?

> `optional` **progress?**: `object`

Adapter-declared non-terminal progress.

#### at

> **at**: `number`

#### detail?

> `optional` **detail?**: `string`

#### fraction?

> `optional` **fraction?**: `number`

***

### proposalId?

> `optional` **proposalId?**: `string`

***

### reservationId?

> `optional` **reservationId?**: `string`

RFC-019 reservation to settle after confirmed/failed reconciliation.

***

### result?

> `optional` **result?**: `unknown`

***

### status

> **status**: [`OperationStatus`](../type-aliases/OperationStatus.md)

***

### updatedAt

> **updatedAt**: `number`
