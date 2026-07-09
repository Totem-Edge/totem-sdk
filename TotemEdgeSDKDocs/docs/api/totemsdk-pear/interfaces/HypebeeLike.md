[**@totemsdk/pear**](../index.md)

***

[@totemsdk/pear](../index.md) / HypebeeLike

# Interface: HypebeeLike

## Methods

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### createReadStream()

> **createReadStream**(`options?`): `AsyncIterable`\<\{ `key`: `string`; \}\>

#### Parameters

##### options?

###### gt?

`string`

###### lt?

`string`

#### Returns

`AsyncIterable`\<\{ `key`: `string`; \}\>

***

### del()

> **del**(`key`): `Promise`\<`void`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

***

### get()

> **get**(`key`): `Promise`\<\{ `value`: `unknown`; \} \| `null`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<\{ `value`: `unknown`; \} \| `null`\>

***

### put()

> **put**(`key`, `value`): `Promise`\<`void`\>

#### Parameters

##### key

`string`

##### value

`unknown`

#### Returns

`Promise`\<`void`\>

***

### ready()

> **ready**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>
