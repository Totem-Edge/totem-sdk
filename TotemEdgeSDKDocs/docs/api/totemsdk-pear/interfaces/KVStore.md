[**@totemsdk/pear**](../index.md)

***

[@totemsdk/pear](../index.md) / KVStore

# Interface: KVStore

@totemsdk/pear — KVStore interface

Structurally identical to `StorageAdapter` from `@totemsdk/core` so that
both `BareKVStore` and `BareFileStore` can be passed directly to
`LocalLeaseProvider`, `WotsWatermarkStore`, and `lookup-client` storage slots
without any adapter glue.

No import from @totemsdk/core is used here to keep this package dependency-free.

## Methods

### clear()

> **clear**(): `Promise`\<`void`\>

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

***

### has()

> **has**(`key`): `Promise`\<`boolean`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`boolean`\>

***

### keys()

> **keys**(): `Promise`\<`string`[]\>

#### Returns

`Promise`\<`string`[]\>

***

### remove()

> **remove**(`key`): `Promise`\<`boolean`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`boolean`\>

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
