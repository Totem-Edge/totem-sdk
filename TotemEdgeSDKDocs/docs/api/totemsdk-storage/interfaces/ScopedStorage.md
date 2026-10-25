[**@totemsdk/storage**](../index.md)

***

[@totemsdk/storage](../index.md) / ScopedStorage

# Interface: ScopedStorage

Scoped, capability-preserving view. No close(); lifecycle owned by caller.

## Extends

- [`StorageAdapterWithCapabilities`](StorageAdapterWithCapabilities.md)

## Properties

### capabilities

> `readonly` **capabilities**: [`StoreCapabilities`](StoreCapabilities.md)

#### Inherited from

[`StorageAdapterWithCapabilities`](StorageAdapterWithCapabilities.md).[`capabilities`](StorageAdapterWithCapabilities.md#capabilities)

***

### cas?

> `readonly` `optional` **cas?**: [`CasStore`](CasStore.md)

Scoped CAS facade; keys are scope-relative. Never the raw CasStore.

***

### failurePolicy

> `readonly` **failurePolicy**: `"strict"` \| `"lenient"`

RFC-007 Amendment A (§A.3.2): the adapter's corruption policy, observable
**outside** `StoreCapabilities` so a strict consumer can reject a lenient
adapter at construction — before a corrupt read is collapsed into `null`.
`MemoryStore` reports `'strict'` (it cannot corrupt).

#### Inherited from

[`StorageAdapterWithCapabilities`](StorageAdapterWithCapabilities.md).[`failurePolicy`](StorageAdapterWithCapabilities.md#failurepolicy)

***

### scope

> `readonly` **scope**: [`StorageScope`](StorageScope.md)

## Methods

### clear()

> **clear**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`StorageAdapterWithCapabilities`](StorageAdapterWithCapabilities.md).[`clear`](StorageAdapterWithCapabilities.md#clear)

***

### close()?

> `optional` **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`StorageAdapterWithCapabilities`](StorageAdapterWithCapabilities.md).[`close`](StorageAdapterWithCapabilities.md#close)

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

[`StorageAdapterWithCapabilities`](StorageAdapterWithCapabilities.md).[`get`](StorageAdapterWithCapabilities.md#get)

***

### has()

> **has**(`key`): `Promise`\<`boolean`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`boolean`\>

#### Inherited from

[`StorageAdapterWithCapabilities`](StorageAdapterWithCapabilities.md).[`has`](StorageAdapterWithCapabilities.md#has)

***

### keys()

> **keys**(): `Promise`\<`string`[]\>

#### Returns

`Promise`\<`string`[]\>

#### Inherited from

[`StorageAdapterWithCapabilities`](StorageAdapterWithCapabilities.md).[`keys`](StorageAdapterWithCapabilities.md#keys)

***

### remove()

> **remove**(`key`): `Promise`\<`boolean`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`boolean`\>

#### Inherited from

[`StorageAdapterWithCapabilities`](StorageAdapterWithCapabilities.md).[`remove`](StorageAdapterWithCapabilities.md#remove)

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

[`StorageAdapterWithCapabilities`](StorageAdapterWithCapabilities.md).[`set`](StorageAdapterWithCapabilities.md#set)
