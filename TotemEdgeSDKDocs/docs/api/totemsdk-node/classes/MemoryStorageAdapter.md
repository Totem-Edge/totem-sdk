[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / MemoryStorageAdapter

# Class: MemoryStorageAdapter

## Implements

- [`StorageAdapter`](../interfaces/StorageAdapter.md)

## Constructors

### Constructor

> **new MemoryStorageAdapter**(): `MemoryStorageAdapter`

#### Returns

`MemoryStorageAdapter`

## Methods

### clear()

> **clear**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`StorageAdapter`](../interfaces/StorageAdapter.md).[`clear`](../interfaces/StorageAdapter.md#clear)

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

[`StorageAdapter`](../interfaces/StorageAdapter.md).[`get`](../interfaces/StorageAdapter.md#get)

***

### has()

> **has**(`key`): `Promise`\<`boolean`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`StorageAdapter`](../interfaces/StorageAdapter.md).[`has`](../interfaces/StorageAdapter.md#has)

***

### keys()

> **keys**(): `Promise`\<`string`[]\>

#### Returns

`Promise`\<`string`[]\>

#### Implementation of

[`StorageAdapter`](../interfaces/StorageAdapter.md).[`keys`](../interfaces/StorageAdapter.md#keys)

***

### remove()

> **remove**(`key`): `Promise`\<`boolean`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`StorageAdapter`](../interfaces/StorageAdapter.md).[`remove`](../interfaces/StorageAdapter.md#remove)

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

[`StorageAdapter`](../interfaces/StorageAdapter.md).[`set`](../interfaces/StorageAdapter.md#set)
