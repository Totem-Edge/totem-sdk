[**@totemsdk/wallet-adapter**](../index.md)

***

[@totemsdk/wallet-adapter](../index.md) / TotemWalletAdapter

# Abstract Class: TotemWalletAdapter

Abstract base class for third-party Totem-compatible wallets.

Subclass this and implement only three methods:
- `getAccounts(origin)` — return the list of accounts for a dApp origin
- `signTransaction(origin, params)` — sign an unsigned transaction hex
- `signData(origin, params)` — sign arbitrary data hex

Everything else — TOTEM_CONNECT handshake, TOTEM_GET_CAPABILITIES,
connected-site gating, chain provider switching, and the totem:announce
injection — is handled automatically by the base class.

Call `adapter.inject()` once from your extension content script or page
context to make the wallet discoverable by any dApp using WalletDiscovery
from @totemsdk/connect.

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

## Methods

### destroy()

> **destroy**(): `void`

Remove the `totem:requestAnnounce` listener and clear all state.
After calling destroy() the adapter will no longer respond to dApp
discovery requests.

#### Returns

`void`

***

### emit()

> `protected` **emit**(`event`, ...`args`): `void`

Emit an event to all dApp listeners subscribed via provider.on().
Call this from your subclass when wallet state changes (e.g. account changed).

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

Return the accounts this wallet manages for the given dApp origin.
Called on TOTEM_CONNECT and TOTEM_GET_ACCOUNTS.

Note: `publicKey` must be a non-null hex string for any account that
will be used with TOTEM_VERIFY. Return null only for accounts that
will never need to produce verification signatures.

#### Parameters

##### origin

`string`

#### Returns

`Promise`\<[`GetAccountsResponse`](../interfaces/GetAccountsResponse.md)\>

***

### handleRequest()

> **handleRequest**(`method`, `params?`): `Promise`\<`unknown`\>

Dispatch a single RPC request as if it came from a dApp provider.request() call.
Useful for testing without a real browser environment.

#### Parameters

##### method

`string`

##### params?

`Record`\<`string`, `unknown`\> = `{}`

#### Returns

`Promise`\<`unknown`\>

***

### inject()

> **inject**(): `void`

Fire `totem:announce` and register a `totem:requestAnnounce` listener
so the wallet re-announces on demand. Safe to call from a content script
or an injected MAIN-world script.

No-op if called more than once — call `destroy()` first to re-inject.

#### Returns

`void`

***

### isConnected()

> `protected` **isConnected**(`origin`): `boolean`

Check whether a given origin has called TOTEM_CONNECT.
Useful in subclass implementations that want to gate custom behaviour.

#### Parameters

##### origin

`string`

#### Returns

`boolean`

***

### signData()

> `abstract` `protected` **signData**(`origin`, `params`): `Promise`\<[`SignDataResponse`](../interfaces/SignDataResponse.md)\>

Sign arbitrary data (used for TOTEM_SIGN_DATA and TOTEM_VERIFY).

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

Sign an unsigned Minima transaction hex.
Called on totem_signTransaction.
The base class does NOT perform coin selection — if you need it, handle
TOTEM_SEND_TRANSACTION as a future extension point in your subclass.

#### Parameters

##### origin

`string`

##### params

[`SignTransactionParams`](../interfaces/SignTransactionParams.md)

#### Returns

`Promise`\<[`SignTransactionResponse`](../interfaces/SignTransactionResponse.md)\>
