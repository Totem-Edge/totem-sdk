[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / PurchaseStore

# Interface: PurchaseStore

A durable purchase/session store with atomic CAS semantics.

## Methods

### compareAndSet()

> **compareAndSet**(`purchaseId`, `expectedRevision`, `next`): `Promise`\<`boolean`\>

#### Parameters

##### purchaseId

`string`

##### expectedRevision

`number`

##### next

[`PurchaseRecord`](PurchaseRecord.md)

#### Returns

`Promise`\<`boolean`\>

***

### create()

> **create**(`record`): `Promise`\<`void`\>

#### Parameters

##### record

[`PurchaseRecord`](PurchaseRecord.md)

#### Returns

`Promise`\<`void`\>

***

### get()

> **get**(`purchaseId`): `Promise`\<[`PurchaseRecord`](PurchaseRecord.md) \| `undefined`\>

#### Parameters

##### purchaseId

`string`

#### Returns

`Promise`\<[`PurchaseRecord`](PurchaseRecord.md) \| `undefined`\>

***

### listRecoverable()?

> `optional` **listRecoverable**(): `Promise`\<[`PurchaseRecord`](PurchaseRecord.md)[]\>

#### Returns

`Promise`\<[`PurchaseRecord`](PurchaseRecord.md)[]\>
