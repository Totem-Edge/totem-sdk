[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / EnvironmentAuthProvider

# Class: EnvironmentAuthProvider

## Implements

- [`AuthTokenProvider`](../interfaces/AuthTokenProvider.md)

## Constructors

### Constructor

> **new EnvironmentAuthProvider**(`envVarName?`): `EnvironmentAuthProvider`

#### Parameters

##### envVarName?

`string` = `'TOTEM_AUTH_TOKEN'`

#### Returns

`EnvironmentAuthProvider`

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

> **onTokenChange**(`_callback`): () => `void`

#### Parameters

##### \_callback

(`token`) => `void`

#### Returns

() => `void`

#### Implementation of

[`AuthTokenProvider`](../interfaces/AuthTokenProvider.md).[`onTokenChange`](../interfaces/AuthTokenProvider.md#ontokenchange)

***

### setToken()

> **setToken**(`_token`): `Promise`\<`void`\>

#### Parameters

##### \_token

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`AuthTokenProvider`](../interfaces/AuthTokenProvider.md).[`setToken`](../interfaces/AuthTokenProvider.md#settoken)
