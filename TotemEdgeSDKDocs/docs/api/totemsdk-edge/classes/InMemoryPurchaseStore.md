[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / InMemoryPurchaseStore

# Class: InMemoryPurchaseStore

In-memory purchase store. No crash guarantees — dev/test only.

## Implements

- [`PurchaseStore`](../interfaces/PurchaseStore.md)

## Constructors

### Constructor

> **new InMemoryPurchaseStore**(): `InMemoryPurchaseStore`

#### Returns

`InMemoryPurchaseStore`

## Methods

### compareAndSet()

> **compareAndSet**(`purchaseId`, `expectedRevision`, `next`): `Promise`\<`boolean`\>

#### Parameters

##### purchaseId

`string`

##### expectedRevision

`number`

##### next

[`PurchaseRecord`](../interfaces/PurchaseRecord.md)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`PurchaseStore`](../interfaces/PurchaseStore.md).[`compareAndSet`](../interfaces/PurchaseStore.md#compareandset)

***

### create()

> **create**(`record`): `Promise`\<`void`\>

#### Parameters

##### record

[`PurchaseRecord`](../interfaces/PurchaseRecord.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`PurchaseStore`](../interfaces/PurchaseStore.md).[`create`](../interfaces/PurchaseStore.md#create)

***

### get()

> **get**(`purchaseId`): `Promise`\<[`PurchaseRecord`](../interfaces/PurchaseRecord.md) \| `undefined`\>

#### Parameters

##### purchaseId

`string`

#### Returns

`Promise`\<[`PurchaseRecord`](../interfaces/PurchaseRecord.md) \| `undefined`\>

#### Implementation of

[`PurchaseStore`](../interfaces/PurchaseStore.md).[`get`](../interfaces/PurchaseStore.md#get)

***

### listRecoverable()

> **listRecoverable**(): `Promise`\<[`PurchaseRecord`](../interfaces/PurchaseRecord.md)[]\>

#### Returns

`Promise`\<[`PurchaseRecord`](../interfaces/PurchaseRecord.md)[]\>

#### Implementation of

[`PurchaseStore`](../interfaces/PurchaseStore.md).[`listRecoverable`](../interfaces/PurchaseStore.md#listrecoverable)
