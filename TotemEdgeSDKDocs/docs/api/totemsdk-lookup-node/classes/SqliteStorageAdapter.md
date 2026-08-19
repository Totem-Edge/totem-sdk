[**@totemsdk/lookup-node**](../index.md)

***

[@totemsdk/lookup-node](../index.md) / SqliteStorageAdapter

# Class: SqliteStorageAdapter

Wraps SqliteStore's durable KV store to implement the `StorageAdapter`
interface expected by `LocalLeaseProvider` and other @totemsdk/core consumers.

All methods are async for interface compliance but execute synchronously
against the SQLite backend (better-sqlite3 is synchronous).

## Implements

- `StorageAdapter`

## Constructors

### Constructor

> **new SqliteStorageAdapter**(`_store`): `SqliteStorageAdapter`

#### Parameters

##### \_store

[`SqliteStore`](SqliteStore.md)

#### Returns

`SqliteStorageAdapter`

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
