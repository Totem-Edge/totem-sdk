[**@totemsdk/storage**](../index.md)

***

[@totemsdk/storage](../index.md) / StorageAdapterWithCapabilities

# Interface: StorageAdapterWithCapabilities

## Extends

- [`StorageAdapter`](StorageAdapter.md)

## Extended by

- [`ScopedStorage`](ScopedStorage.md)

## Properties

### capabilities

> `readonly` **capabilities**: [`StoreCapabilities`](StoreCapabilities.md)

***

### failurePolicy

> `readonly` **failurePolicy**: `"strict"` \| `"lenient"`

RFC-007 Amendment A (§A.3.2): the adapter's corruption policy, observable
**outside** `StoreCapabilities` so a strict consumer can reject a lenient
adapter at construction — before a corrupt read is collapsed into `null`.
`MemoryStore` reports `'strict'` (it cannot corrupt).

## Methods

### clear()

> **clear**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`StorageAdapter`](StorageAdapter.md).[`clear`](StorageAdapter.md#clear)

***

### close()?

> `optional` **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

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

#### Inherited from

[`StorageAdapter`](StorageAdapter.md).[`get`](StorageAdapter.md#get)

***

### has()

> **has**(`key`): `Promise`\<`boolean`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`boolean`\>

#### Inherited from

[`StorageAdapter`](StorageAdapter.md).[`has`](StorageAdapter.md#has)

***

### keys()

> **keys**(): `Promise`\<`string`[]\>

#### Returns

`Promise`\<`string`[]\>

#### Inherited from

[`StorageAdapter`](StorageAdapter.md).[`keys`](StorageAdapter.md#keys)

***

### remove()

> **remove**(`key`): `Promise`\<`boolean`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`boolean`\>

#### Inherited from

[`StorageAdapter`](StorageAdapter.md).[`remove`](StorageAdapter.md#remove)

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

#### Inherited from

[`StorageAdapter`](StorageAdapter.md).[`set`](StorageAdapter.md#set)
