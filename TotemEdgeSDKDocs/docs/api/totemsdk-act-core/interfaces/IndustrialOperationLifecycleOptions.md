[**@totemsdk/act-core**](../index.md)

***

[@totemsdk/act-core](../index.md) / IndustrialOperationLifecycleOptions

# Interface: IndustrialOperationLifecycleOptions\<TResult\>

## Type Parameters

### TResult

`TResult` = `unknown`

## Properties

### def

> **def**: [`IndustrialActionDefinition`](IndustrialActionDefinition.md)\<`TResult`\>

***

### now?

> `optional` **now?**: () => `number`

#### Returns

`number`

***

### store

> **store**: [`DeviceOperationStore`](DeviceOperationStore.md)

## Methods

### resolvePrepared()

> **resolvePrepared**(`record`): `Promise`\<[`PreparedDeviceOp`](PreparedDeviceOp.md) \| `undefined`\>

Fetch the prepared command for a durable record, or undefined if unavailable.

#### Parameters

##### record

[`DeviceOperationRecord`](DeviceOperationRecord.md)

#### Returns

`Promise`\<[`PreparedDeviceOp`](PreparedDeviceOp.md) \| `undefined`\>
