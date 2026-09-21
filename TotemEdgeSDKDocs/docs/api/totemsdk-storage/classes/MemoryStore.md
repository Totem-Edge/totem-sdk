[**@totemsdk/storage**](../index.md)

***

[@totemsdk/storage](../index.md) / MemoryStore

# Class: MemoryStore

## Implements

- [`StorageAdapterWithCapabilities`](../interfaces/StorageAdapterWithCapabilities.md)
- [`CasStore`](../interfaces/CasStore.md)
- [`TransactionalStore`](../interfaces/TransactionalStore.md)

## Constructors

### Constructor

> **new MemoryStore**(): `MemoryStore`

#### Returns

`MemoryStore`

## Properties

### capabilities

> `readonly` **capabilities**: [`StoreCapabilities`](../interfaces/StoreCapabilities.md)

#### Implementation of

[`StorageAdapterWithCapabilities`](../interfaces/StorageAdapterWithCapabilities.md).[`capabilities`](../interfaces/StorageAdapterWithCapabilities.md#capabilities)

## Methods

### clear()

> **clear**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`StorageAdapterWithCapabilities`](../interfaces/StorageAdapterWithCapabilities.md).[`clear`](../interfaces/StorageAdapterWithCapabilities.md#clear)

***

### conditionalUpdate()

> **conditionalUpdate**\<`T`\>(`key`, `update`): `Promise`\<[`ConditionalResult`](../interfaces/ConditionalResult.md)\<`T`\>\>

#### Type Parameters

##### T

`T`

#### Parameters

##### key

`string`

##### update

[`ConditionalUpdater`](../type-aliases/ConditionalUpdater.md)\<`T`\>

#### Returns

`Promise`\<[`ConditionalResult`](../interfaces/ConditionalResult.md)\<`T`\>\>

#### Implementation of

[`CasStore`](../interfaces/CasStore.md).[`conditionalUpdate`](../interfaces/CasStore.md#conditionalupdate)

***

### get()

> **get**\<`T`\>(`key`): `Promise`\<`T` \| `null`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`T` \| `null`\>

#### Implementation of

[`StorageAdapterWithCapabilities`](../interfaces/StorageAdapterWithCapabilities.md).[`get`](../interfaces/StorageAdapterWithCapabilities.md#get)

***

### has()

> **has**(`key`): `Promise`\<`boolean`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`StorageAdapterWithCapabilities`](../interfaces/StorageAdapterWithCapabilities.md).[`has`](../interfaces/StorageAdapterWithCapabilities.md#has)

***

### keys()

> **keys**(): `Promise`\<`string`[]\>

#### Returns

`Promise`\<`string`[]\>

#### Implementation of

[`StorageAdapterWithCapabilities`](../interfaces/StorageAdapterWithCapabilities.md).[`keys`](../interfaces/StorageAdapterWithCapabilities.md#keys)

***

### remove()

> **remove**(`key`): `Promise`\<`boolean`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`StorageAdapterWithCapabilities`](../interfaces/StorageAdapterWithCapabilities.md).[`remove`](../interfaces/StorageAdapterWithCapabilities.md#remove)

***

### set()

> **set**\<`T`\>(`key`, `value`): `Promise`\<`void`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### key

`string`

##### value

`T`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`StorageAdapterWithCapabilities`](../interfaces/StorageAdapterWithCapabilities.md).[`set`](../interfaces/StorageAdapterWithCapabilities.md#set)

***

### transaction()

> **transaction**(): [`Transaction`](../interfaces/Transaction.md)

#### Returns

[`Transaction`](../interfaces/Transaction.md)

#### Implementation of

[`TransactionalStore`](../interfaces/TransactionalStore.md).[`transaction`](../interfaces/TransactionalStore.md#transaction)
