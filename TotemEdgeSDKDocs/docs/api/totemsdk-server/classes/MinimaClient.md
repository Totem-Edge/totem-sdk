[**@totemsdk/server**](../index.md)

***

[@totemsdk/server](../index.md) / MinimaClient

# Class: MinimaClient

## Extends

- `unknown`

## Constructors

### Constructor

> **new MinimaClient**(`config`): `MinimaClient`

#### Parameters

##### config

`ClientConfig`

#### Returns

`MinimaClient`

#### Overrides

`EventEmitter.constructor`

## Methods

### buildTransaction()

> **buildTransaction**(`_params`): `Promise`\<`Transaction`\>

Build a transaction client-side.
NOTE: Axia has no server-side build endpoint — transactions must be
constructed locally using @totemsdk/tx-builder.

#### Parameters

##### \_params

###### amount

`string`

###### data?

`string`

###### fee?

`string`

###### from

`string`

###### to

`string`

#### Returns

`Promise`\<`Transaction`\>

***

### connect()

> **connect**(): `Promise`\<`void`\>

Fetch a short-lived JWT from the API then open the balance WebSocket.
Messages are emitted as 'balance' events (portfolio_snapshot / portfolio_delta).

#### Returns

`Promise`\<`void`\>

***

### disconnect()

> **disconnect**(): `void`

Disconnect from network

#### Returns

`void`

***

### getBalance()

> **getBalance**(`address`, `tokenId?`): `Promise`\<`string`\>

Get total confirmed Minima balance for an address.
Uses GET /v1/wallet/portfolio/:address and sums the native token entry.

#### Parameters

##### address

`string`

##### tokenId?

`string`

#### Returns

`Promise`\<`string`\>

***

### getBlockHeight()

> **getBlockHeight**(): `Promise`\<`number`\>

Get current chain tip block height via Minima `status` RPC.

#### Returns

`Promise`\<`number`\>

***

### getUTXOs()

> **getUTXOs**(`address`): `Promise`\<`UTXO`[]\>

Get raw UTXOs (coins) for an address.
Returns the UTXO list from GET /v1/wallet/utxos/:address.

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`UTXO`[]\>

***

### submitTransaction()

> **submitTransaction**(`signedTxHex`): `Promise`\<`string`\>

Submit a pre-built, signed transaction hex via Minima txnpost RPC.
For the full production path (mine + submit) use MinimaWallet.mineAndSubmitTxPoW().

#### Parameters

##### signedTxHex

`string`

#### Returns

`Promise`\<`string`\>

***

### subscribe()

> **subscribe**(`addresses`): `void`

Subscribe the open WebSocket to a set of addresses.

#### Parameters

##### addresses

`string`[]

#### Returns

`void`
