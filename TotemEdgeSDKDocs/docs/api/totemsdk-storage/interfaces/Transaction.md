[**@totemsdk/storage**](../index.md)

***

[@totemsdk/storage](../index.md) / Transaction

# Interface: Transaction

## Methods

### commit()

> **commit**(): `Promise`\<`void`\>

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

### remove()

> **remove**(`key`): `Transaction`

#### Parameters

##### key

`string`

#### Returns

`Transaction`

***

### set()

> **set**\<`T`\>(`key`, `value`): `Transaction`

#### Type Parameters

##### T

`T`

#### Parameters

##### key

`string`

##### value

`T`

#### Returns

`Transaction`
