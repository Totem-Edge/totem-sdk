[**@totemsdk/wallet-adapter**](../index.md)

***

[@totemsdk/wallet-adapter](../index.md) / TotemWalletAdapter

# Abstract Class: TotemWalletAdapter

## Constructors

### Constructor

> **new TotemWalletAdapter**(`config`): `TotemWalletAdapter`

#### Parameters

##### config

[`WalletAdapterConfig`](../interfaces/WalletAdapterConfig.md)

#### Returns

`TotemWalletAdapter`

## Properties

### \_chainProvider

> `protected` **\_chainProvider**: [`ChainProviderLike`](../interfaces/ChainProviderLike.md) \| `null`

## Accessors

### lease

#### Get Signature

> **get** `protected` **lease**(): `WotsLeasePort` \| `undefined`

WOTS lease port for subclasses that coordinate key-use budgets.

##### Returns

`WotsLeasePort` \| `undefined`

***

### provider

#### Get Signature

> **get** **provider**(): `TotemProvider`

The composed provider (full `TotemProvider` surface).

##### Returns

`TotemProvider`

## Methods

### broadcastHex()?

> `protected` `optional` **broadcastHex**(`origin`, `params`): `Promise`\<`unknown`\>

#### Parameters

##### origin

`string`

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### broadcastTxPoW()?

> `protected` `optional` **broadcastTxPoW**(`origin`, `params`): `Promise`\<`unknown`\>

#### Parameters

##### origin

`string`

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### createToken()?

> `protected` `optional` **createToken**(`origin`, `params`): `Promise`\<`unknown`\>

#### Parameters

##### origin

`string`

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### destroy()

> **destroy**(): `void`

#### Returns

`void`

***

### emit()

> `protected` **emit**(`event`, ...`args`): `void`

#### Parameters

##### event

`string`

##### args

...`unknown`[]

#### Returns

`void`

***

### getAccounts()

> `abstract` `protected` **getAccounts**(`origin`): `Promise`\<[`GetAccountsResponse`](../interfaces/GetAccountsResponse.md)\>

#### Parameters

##### origin

`string`

#### Returns

`Promise`\<[`GetAccountsResponse`](../interfaces/GetAccountsResponse.md)\>

***

### getTxPermissions()?

> `protected` `optional` **getTxPermissions**(`origin`, `params`): `Promise`\<`unknown`\>

#### Parameters

##### origin

`string`

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### getWotsStatus()?

> `protected` `optional` **getWotsStatus**(`origin`, `params`): `Promise`\<`unknown`\>

#### Parameters

##### origin

`string`

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### grantTxPermission()?

> `protected` `optional` **grantTxPermission**(`origin`, `params`): `Promise`\<`unknown`\>

#### Parameters

##### origin

`string`

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### handleRequest()

> **handleRequest**(`method`, `params?`, `origin?`): `Promise`\<`unknown`\>

Dispatch a request. `origin` is the host-resolved trusted origin; when
omitted it is resolved from `getOrigin` (or `window.location.origin`).

#### Parameters

##### method

`string`

##### params?

`Record`\<`string`, `unknown`\> = `{}`

##### origin?

`string`

#### Returns

`Promise`\<`unknown`\>

***

### inject()

> **inject**(): `void`

#### Returns

`void`

***

### isConnected()

> `protected` **isConnected**(`origin`): `boolean`

#### Parameters

##### origin

`string`

#### Returns

`boolean`

***

### meta()

> **meta**(): `WalletRuntimeMeta`

Method-support manifest (handled vs unsupported + reasons).

#### Returns

`WalletRuntimeMeta`

***

### mineTxPoW()?

> `protected` `optional` **mineTxPoW**(`origin`, `params`): `Promise`\<`unknown`\>

#### Parameters

##### origin

`string`

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### proveOwnership()?

> `protected` `optional` **proveOwnership**(`origin`, `params`): `Promise`\<`unknown`\>

#### Parameters

##### origin

`string`

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### revokeTxPermission()?

> `protected` `optional` **revokeTxPermission**(`origin`, `params`): `Promise`\<`unknown`\>

#### Parameters

##### origin

`string`

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### sendComplex()?

> `protected` `optional` **sendComplex**(`origin`, `params`): `Promise`\<`unknown`\>

#### Parameters

##### origin

`string`

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### sendTransaction()?

> `protected` `optional` **sendTransaction**(`origin`, `params`): `Promise`\<`unknown`\>

#### Parameters

##### origin

`string`

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### signData()

> `abstract` `protected` **signData**(`origin`, `params`): `Promise`\<[`SignDataResponse`](../interfaces/SignDataResponse.md)\>

#### Parameters

##### origin

`string`

##### params

[`SignDataParams`](../interfaces/SignDataParams.md)

#### Returns

`Promise`\<[`SignDataResponse`](../interfaces/SignDataResponse.md)\>

***

### signTransaction()

> `abstract` `protected` **signTransaction**(`origin`, `params`): `Promise`\<[`SignTransactionResponse`](../interfaces/SignTransactionResponse.md)\>

#### Parameters

##### origin

`string`

##### params

[`SignTransactionParams`](../interfaces/SignTransactionParams.md)

#### Returns

`Promise`\<[`SignTransactionResponse`](../interfaces/SignTransactionResponse.md)\>
