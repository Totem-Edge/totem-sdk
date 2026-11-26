[**@totemsdk/identity**](../index.md)

***

[@totemsdk/identity](../index.md) / IdentityIndexPort

# Interface: IdentityIndexPort

## Methods

### get()

> **get**(`key`): `Promise`\<`unknown`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`unknown`\>

***

### list()?

> `optional` **list**(`prefix?`): `AsyncIterable`\<\{ `key`: `string`; `value`: `unknown`; \}\>

#### Parameters

##### prefix?

`string`

#### Returns

`AsyncIterable`\<\{ `key`: `string`; `value`: `unknown`; \}\>

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
