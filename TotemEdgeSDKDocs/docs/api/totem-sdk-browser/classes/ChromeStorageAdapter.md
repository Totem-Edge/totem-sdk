[**@totem/sdk-browser**](../index.md)

***

[@totem/sdk-browser](../index.md) / ChromeStorageAdapter

# Class: ChromeStorageAdapter

## Implements

- `StorageAdapter`

## Constructors

### Constructor

> **new ChromeStorageAdapter**(`options?`): `ChromeStorageAdapter`

#### Parameters

##### options?

[`ChromeStorageAdapterOptions`](../interfaces/ChromeStorageAdapterOptions.md) = `{}`

#### Returns

`ChromeStorageAdapter`

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
