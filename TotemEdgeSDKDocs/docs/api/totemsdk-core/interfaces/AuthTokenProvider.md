[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / AuthTokenProvider

# Interface: AuthTokenProvider

## Methods

### clearToken()

> **clearToken**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### getToken()

> **getToken**(): `Promise`\<`string` \| `null`\>

#### Returns

`Promise`\<`string` \| `null`\>

***

### isAuthenticated()

> **isAuthenticated**(): `Promise`\<`boolean`\>

#### Returns

`Promise`\<`boolean`\>

***

### onTokenChange()

> **onTokenChange**(`callback`): () => `void`

#### Parameters

##### callback

(`token`) => `void`

#### Returns

() => `void`

***

### setToken()

> **setToken**(`token`): `Promise`\<`void`\>

#### Parameters

##### token

`string`

#### Returns

`Promise`\<`void`\>
