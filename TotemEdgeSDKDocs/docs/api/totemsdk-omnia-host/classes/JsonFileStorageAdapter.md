[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / JsonFileStorageAdapter

# Class: JsonFileStorageAdapter

JSON-file-backed StorageAdapter rooted at a directory next to the channel DB.

Delegates to the hardened shared `FileStore` from `@totemsdk/storage/fs`
(RFC-007): one versioned codec record per key written temp+rename with an
fsync; corrupt records surface as `StorageError` (`corrupt`) rather than
silently returning JSON `null`. The directory is created on first write.

## Implements

- `StorageAdapter`

## Constructors

### Constructor

> **new JsonFileStorageAdapter**(`dir`): `JsonFileStorageAdapter`

#### Parameters

##### dir

`string`

#### Returns

`JsonFileStorageAdapter`

## Methods

### clear()

> **clear**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

`StorageAdapter.clear`

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

`StorageAdapter.get`

***

### has()

> **has**(`key`): `Promise`\<`boolean`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

`StorageAdapter.has`

***

### keys()

> **keys**(): `Promise`\<`string`[]\>

#### Returns

`Promise`\<`string`[]\>

#### Implementation of

`StorageAdapter.keys`

***

### remove()

> **remove**(`key`): `Promise`\<`boolean`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

`StorageAdapter.remove`

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

`StorageAdapter.set`
