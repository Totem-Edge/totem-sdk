[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / ConfigProvider

# Interface: ConfigProvider

## Properties

### apiKey?

> `readonly` `optional` **apiKey?**: `string`

***

### apiUrl

> `readonly` **apiUrl**: `string`

***

### network

> `readonly` **network**: `"mainnet"` \| `"testnet"` \| `"devnet"`

***

### wsUrl

> `readonly` **wsUrl**: `string`

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

***

### getAll()

> **getAll**(): `Record`\<`string`, `unknown`\>

#### Returns

`Record`\<`string`, `unknown`\>

***

### has()

> **has**(`key`): `boolean`

#### Parameters

##### key

`string`

#### Returns

`boolean`

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
