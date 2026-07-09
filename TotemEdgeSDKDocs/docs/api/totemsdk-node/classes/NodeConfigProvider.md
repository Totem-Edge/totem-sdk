[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / NodeConfigProvider

# Class: NodeConfigProvider

## Implements

- [`ConfigProvider`](../interfaces/ConfigProvider.md)

## Constructors

### Constructor

> **new NodeConfigProvider**(`options`): `NodeConfigProvider`

#### Parameters

##### options

[`NodeConfigOptions`](../interfaces/NodeConfigOptions.md)

#### Returns

`NodeConfigProvider`

## Properties

### apiKey?

> `readonly` `optional` **apiKey?**: `string`

#### Implementation of

[`ConfigProvider`](../interfaces/ConfigProvider.md).[`apiKey`](../interfaces/ConfigProvider.md#apikey)

***

### apiUrl

> `readonly` **apiUrl**: `string`

#### Implementation of

[`ConfigProvider`](../interfaces/ConfigProvider.md).[`apiUrl`](../interfaces/ConfigProvider.md#apiurl)

***

### network

> `readonly` **network**: `"mainnet"` \| `"testnet"` \| `"devnet"`

#### Implementation of

[`ConfigProvider`](../interfaces/ConfigProvider.md).[`network`](../interfaces/ConfigProvider.md#network)

***

### wsUrl

> `readonly` **wsUrl**: `string`

#### Implementation of

[`ConfigProvider`](../interfaces/ConfigProvider.md).[`wsUrl`](../interfaces/ConfigProvider.md#wsurl)

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

[`ConfigProvider`](../interfaces/ConfigProvider.md).[`get`](../interfaces/ConfigProvider.md#get)

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

[`ConfigProvider`](../interfaces/ConfigProvider.md).[`get`](../interfaces/ConfigProvider.md#get)

***

### getAll()

> **getAll**(): `Record`\<`string`, `unknown`\>

#### Returns

`Record`\<`string`, `unknown`\>

#### Implementation of

[`ConfigProvider`](../interfaces/ConfigProvider.md).[`getAll`](../interfaces/ConfigProvider.md#getall)

***

### has()

> **has**(`key`): `boolean`

#### Parameters

##### key

`string`

#### Returns

`boolean`

#### Implementation of

[`ConfigProvider`](../interfaces/ConfigProvider.md).[`has`](../interfaces/ConfigProvider.md#has)

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

[`ConfigProvider`](../interfaces/ConfigProvider.md).[`set`](../interfaces/ConfigProvider.md#set)
