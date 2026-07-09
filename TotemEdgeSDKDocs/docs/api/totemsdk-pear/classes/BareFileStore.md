[**@totemsdk/pear**](../index.md)

***

[@totemsdk/pear](../index.md) / BareFileStore

# Class: BareFileStore

@totemsdk/pear — KVStore interface

Structurally identical to `StorageAdapter` from `@totemsdk/core` so that
both `BareKVStore` and `BareFileStore` can be passed directly to
`LocalLeaseProvider`, `WotsWatermarkStore`, and `lookup-client` storage slots
without any adapter glue.

No import from @totemsdk/core is used here to keep this package dependency-free.

## Implements

- [`KVStore`](../interfaces/KVStore.md)

## Constructors

### Constructor

> **new BareFileStore**(`options`): `BareFileStore`

#### Parameters

##### options

[`BareFileStoreOptions`](../interfaces/BareFileStoreOptions.md)

#### Returns

`BareFileStore`

## Methods

### clear()

> **clear**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`KVStore`](../interfaces/KVStore.md).[`clear`](../interfaces/KVStore.md#clear)

***

### flush()

> **flush**(): `Promise`\<`void`\>

Force a synchronous flush of pending writes. Useful before process exit.

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

#### Implementation of

[`KVStore`](../interfaces/KVStore.md).[`get`](../interfaces/KVStore.md#get)

***

### has()

> **has**(`key`): `Promise`\<`boolean`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`KVStore`](../interfaces/KVStore.md).[`has`](../interfaces/KVStore.md#has)

***

### keys()

> **keys**(): `Promise`\<`string`[]\>

#### Returns

`Promise`\<`string`[]\>

#### Implementation of

[`KVStore`](../interfaces/KVStore.md).[`keys`](../interfaces/KVStore.md#keys)

***

### remove()

> **remove**(`key`): `Promise`\<`boolean`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`KVStore`](../interfaces/KVStore.md).[`remove`](../interfaces/KVStore.md#remove)

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

[`KVStore`](../interfaces/KVStore.md).[`set`](../interfaces/KVStore.md#set)
