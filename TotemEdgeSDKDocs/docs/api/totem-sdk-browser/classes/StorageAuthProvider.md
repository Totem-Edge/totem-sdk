[**@totem/sdk-browser**](../index.md)

***

[@totem/sdk-browser](../index.md) / StorageAuthProvider

# Class: StorageAuthProvider

## Implements

- `AuthTokenProvider`

## Constructors

### Constructor

> **new StorageAuthProvider**(`storage`, `options?`): `StorageAuthProvider`

#### Parameters

##### storage

`StorageAdapter`

##### options?

[`StorageAuthProviderOptions`](../interfaces/StorageAuthProviderOptions.md) = `{}`

#### Returns

`StorageAuthProvider`

## Methods

### clearToken()

> **clearToken**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

`AuthTokenProvider.clearToken`

***

### getToken()

> **getToken**(): `Promise`\<`string` \| `null`\>

#### Returns

`Promise`\<`string` \| `null`\>

#### Implementation of

`AuthTokenProvider.getToken`

***

### isAuthenticated()

> **isAuthenticated**(): `Promise`\<`boolean`\>

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

`AuthTokenProvider.isAuthenticated`

***

### onTokenChange()

> **onTokenChange**(`callback`): () => `void`

#### Parameters

##### callback

(`token`) => `void`

#### Returns

() => `void`

#### Implementation of

`AuthTokenProvider.onTokenChange`

***

### setToken()

> **setToken**(`token`): `Promise`\<`void`\>

#### Parameters

##### token

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

`AuthTokenProvider.setToken`
