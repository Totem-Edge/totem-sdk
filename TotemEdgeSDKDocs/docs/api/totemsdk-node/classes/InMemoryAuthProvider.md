[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / InMemoryAuthProvider

# Class: InMemoryAuthProvider

## Implements

- [`AuthTokenProvider`](../interfaces/AuthTokenProvider.md)

## Constructors

### Constructor

> **new InMemoryAuthProvider**(): `InMemoryAuthProvider`

#### Returns

`InMemoryAuthProvider`

## Methods

### clearToken()

> **clearToken**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`AuthTokenProvider`](../interfaces/AuthTokenProvider.md).[`clearToken`](../interfaces/AuthTokenProvider.md#cleartoken)

***

### getToken()

> **getToken**(): `Promise`\<`string` \| `null`\>

#### Returns

`Promise`\<`string` \| `null`\>

#### Implementation of

[`AuthTokenProvider`](../interfaces/AuthTokenProvider.md).[`getToken`](../interfaces/AuthTokenProvider.md#gettoken)

***

### isAuthenticated()

> **isAuthenticated**(): `Promise`\<`boolean`\>

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`AuthTokenProvider`](../interfaces/AuthTokenProvider.md).[`isAuthenticated`](../interfaces/AuthTokenProvider.md#isauthenticated)

***

### onTokenChange()

> **onTokenChange**(`callback`): () => `void`

#### Parameters

##### callback

(`token`) => `void`

#### Returns

() => `void`

#### Implementation of

[`AuthTokenProvider`](../interfaces/AuthTokenProvider.md).[`onTokenChange`](../interfaces/AuthTokenProvider.md#ontokenchange)

***

### setToken()

> **setToken**(`token`): `Promise`\<`void`\>

#### Parameters

##### token

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`AuthTokenProvider`](../interfaces/AuthTokenProvider.md).[`setToken`](../interfaces/AuthTokenProvider.md#settoken)
