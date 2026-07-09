[**@totem/sdk-browser**](../index.md)

***

[@totem/sdk-browser](../index.md) / BrowserConfigProvider

# Class: BrowserConfigProvider

## Implements

- `ConfigProvider`

## Constructors

### Constructor

> **new BrowserConfigProvider**(`options`): `BrowserConfigProvider`

#### Parameters

##### options

[`BrowserConfigOptions`](../interfaces/BrowserConfigOptions.md)

#### Returns

`BrowserConfigProvider`

## Properties

### apiKey?

> `readonly` `optional` **apiKey?**: `string`

#### Implementation of

`ConfigProvider.apiKey`

***

### apiUrl

> `readonly` **apiUrl**: `string`

#### Implementation of

`ConfigProvider.apiUrl`

***

### network

> `readonly` **network**: `"mainnet"` \| `"testnet"` \| `"devnet"`

#### Implementation of

`ConfigProvider.network`

***

### wsUrl

> `readonly` **wsUrl**: `string`

#### Implementation of

`ConfigProvider.wsUrl`

## Methods

### get()

#### Call Signature

> **get**\<`T`\>(`key`): `T` \| `undefined`

##### Type Parameters

###### T

`T`

##### Parameters

###### key

`string`

##### Returns

`T` \| `undefined`

##### Implementation of

`ConfigProvider.get`

#### Call Signature

> **get**\<`T`\>(`key`, `defaultValue`): `T`

##### Type Parameters

###### T

`T`

##### Parameters

###### key

`string`

###### defaultValue

`T`

##### Returns

`T`

##### Implementation of

`ConfigProvider.get`

***

### getAll()

> **getAll**(): `Record`\<`string`, `unknown`\>

#### Returns

`Record`\<`string`, `unknown`\>

#### Implementation of

`ConfigProvider.getAll`

***

### has()

> **has**(`key`): `boolean`

#### Parameters

##### key

`string`

#### Returns

`boolean`

#### Implementation of

`ConfigProvider.has`

***

### set()

> **set**\<`T`\>(`key`, `value`): `void`

#### Type Parameters

##### T

`T`

#### Parameters

##### key

`string`

##### value

`T`

#### Returns

`void`

#### Implementation of

`ConfigProvider.set`
