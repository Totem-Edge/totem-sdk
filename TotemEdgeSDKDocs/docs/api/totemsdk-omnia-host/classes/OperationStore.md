[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / OperationStore

# Class: OperationStore

Durable operation journal with atomic status transitions.

## Constructors

### Constructor

> **new OperationStore**(`dbPath`): `OperationStore`

#### Parameters

##### dbPath

`string`

#### Returns

`OperationStore`

## Methods

### close()

> **close**(): `void`

#### Returns

`void`

***

### create()

> **create**(`operationId`, `request?`, `now?`): [`OperationRecord`](../interfaces/OperationRecord.md)

#### Parameters

##### operationId

`string`

##### request?

`unknown`

##### now?

`number` = `...`

#### Returns

[`OperationRecord`](../interfaces/OperationRecord.md)

***

### get()

> **get**(`operationId`): [`OperationRecord`](../interfaces/OperationRecord.md) \| `undefined`

#### Parameters

##### operationId

`string`

#### Returns

[`OperationRecord`](../interfaces/OperationRecord.md) \| `undefined`

***

### listByStatus()

> **listByStatus**(`status`): [`OperationRecord`](../interfaces/OperationRecord.md)[]

#### Parameters

##### status

[`OperationStatus`](../type-aliases/OperationStatus.md)

#### Returns

[`OperationRecord`](../interfaces/OperationRecord.md)[]

***

### transition()

> **transition**(`operationId`, `from`, `to`, `patch?`, `now?`): [`OperationRecord`](../interfaces/OperationRecord.md)

#### Parameters

##### operationId

`string`

##### from

[`OperationStatus`](../type-aliases/OperationStatus.md)

##### to

[`OperationStatus`](../type-aliases/OperationStatus.md)

##### patch?

###### error?

`string`

###### result?

`unknown`

##### now?

`number` = `...`

#### Returns

[`OperationRecord`](../interfaces/OperationRecord.md)

***

### verifyRequest()

> **verifyRequest**(`operationId`, `request`): `boolean`

#### Parameters

##### operationId

`string`

##### request

`unknown`

#### Returns

`boolean`
